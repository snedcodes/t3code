export type AssistantStatus = "idle" | "starting" | "active" | "stopping" | "stopped" | "error";

export interface RealtimeTarget {
  readonly projectId: string;
  readonly threadId: string;
}

export interface RealtimeTranscriptItem {
  readonly id: string;
  readonly role: "user" | "assistant";
  /** Accumulated text snapshot, rather than a delta. */
  readonly text: string;
}

export interface RealtimeStartContext {
  readonly selectedMessageId?: string;
  readonly documentPaths?: ReadonlyArray<string>;
}

export interface RealtimeTransport {
  start(input: RealtimeTarget & RealtimeStartContext): Promise<string>;
  /** Close the session, release audio, and cancel/settle any pending start. */
  stop(): Promise<void>;
  setMicMuted(muted: boolean): void;
  setAssistantMuted(muted: boolean): void;
  /** Cancel the current response and stop its playback; keep the session open. */
  interrupt(): void;
  subscribe(listeners: {
    transcript(item: RealtimeTranscriptItem): void;
    completed(item: RealtimeTranscriptItem): void;
    error(message: string): void;
    closed(): void;
  }): () => void;
}

export interface RealtimeState {
  readonly status: AssistantStatus;
  readonly sessionId: string | null;
  readonly micMuted: boolean;
  readonly assistantMuted: boolean;
  readonly transcript: ReadonlyArray<RealtimeTranscriptItem & { readonly completed: boolean }>;
  readonly error: string | null;
}

const MAX_TRANSCRIPT_ITEMS = 100;
const MAX_TRANSCRIPT_TEXT = 8_000;

export class RealtimeAssistantController {
  private readonly target: RealtimeTarget;
  private state: RealtimeState = {
    status: "idle",
    sessionId: null,
    micMuted: false,
    assistantMuted: false,
    transcript: [],
    error: null,
  };
  private readonly listeners = new Set<(state: RealtimeState) => void>();
  private generation = 0;
  private disposed = false;
  private unsubscribeTransport: (() => void) | null = null;
  private startTask: Promise<void> | null = null;
  private cleanupTask: Promise<string | null> | null = null;

  constructor(
    target: RealtimeTarget,
    private readonly transport: RealtimeTransport,
  ) {
    this.target = Object.freeze({ projectId: target.projectId, threadId: target.threadId });
  }

  getState(): RealtimeState {
    return this.state;
  }

  subscribe(listener: (state: RealtimeState) => void): () => void {
    if (this.disposed) return () => {};
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Each fresh start resets both mutes and transcript; the target never changes. */
  async start(input: RealtimeStartContext = {}): Promise<void> {
    if (this.disposed || this.state.status === "starting" || this.state.status === "active") return;
    const generation = ++this.generation;
    const previousStart = this.startTask;
    const context: RealtimeStartContext = {
      ...(input.selectedMessageId === undefined
        ? {}
        : { selectedMessageId: input.selectedMessageId }),
      ...(input.documentPaths === undefined ? {} : { documentPaths: [...input.documentPaths] }),
    };
    this.patch({
      status: "starting",
      sessionId: null,
      error: null,
      micMuted: false,
      assistantMuted: false,
      transcript: [],
    });
    const task = this.begin(generation, previousStart, context);
    this.startTask = task;
    await task;
    if (this.startTask === task) this.startTask = null;
  }

  private async begin(
    generation: number,
    previousStart: Promise<void> | null,
    context: RealtimeStartContext,
  ): Promise<void> {
    // One transport cannot safely host a new session before a late old start closes.
    await previousStart;
    const cleanupError = await this.cleanupTask;
    if (!this.current(generation)) return;
    if (cleanupError) {
      this.patch({ status: "error", error: cleanupError });
      return;
    }
    try {
      this.unsubscribeTransport = this.transport.subscribe({
        transcript: (item) => {
          if (this.current(generation)) this.updateTranscript(item, false);
        },
        completed: (item) => {
          if (this.current(generation)) this.updateTranscript(item, true);
        },
        error: (message) => {
          if (this.current(generation)) this.terminal("error", message);
        },
        closed: () => {
          if (this.current(generation)) this.terminal("stopped");
        },
      });
      if (!this.current(generation)) {
        this.detach();
        return;
      }
      this.transport.setMicMuted(this.state.micMuted);
      this.transport.setAssistantMuted(this.state.assistantMuted);
      const sessionId = await this.transport.start({
        ...this.target,
        ...context,
      });
      if (!this.current(generation)) {
        await this.closeTransport();
        return;
      }
      if (!sessionId) throw new Error("Realtime transport returned no session ID.");
      // Negotiation must retain mute changes made while the session was starting.
      this.transport.setMicMuted(this.state.micMuted);
      this.transport.setAssistantMuted(this.state.assistantMuted);
      this.patch({ status: "active", sessionId });
    } catch (error) {
      if (this.current(generation)) {
        this.terminal("error", this.errorMessage(error, "Unable to start realtime audio."));
      }
      await this.closeTransport();
    }
  }

  setMicMuted(muted: boolean): void {
    this.control(() => this.transport.setMicMuted(muted), { micMuted: muted });
  }

  setAssistantMuted(muted: boolean): void {
    this.control(() => this.transport.setAssistantMuted(muted), { assistantMuted: muted });
  }

  interrupt(): void {
    if (this.state.status === "active") this.control(() => this.transport.interrupt());
  }

  private control(action: () => void, patch: Partial<RealtimeState> = {}): void {
    if (this.disposed) return;
    try {
      if (this.state.status === "starting" || this.state.status === "active") action();
      this.patch(patch);
    } catch (error) {
      this.terminal("error", this.errorMessage(error, "Unable to control realtime audio."));
    }
  }

  async stop(): Promise<void> {
    if (this.disposed) return;
    const generation = ++this.generation;
    this.detach();
    if (this.state.status === "idle" || this.state.status === "stopped") {
      if (this.cleanupTask) await this.cleanupTask;
      return;
    }
    this.patch({ status: "stopping", sessionId: null });
    const error = await this.closeTransport();
    if (this.current(generation)) {
      this.patch({ status: error ? "error" : "stopped", sessionId: null, error });
    }
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    ++this.generation;
    this.detach();
    this.patch({ status: "stopping", sessionId: null });
    this.listeners.clear();
    const error = await this.closeTransport();
    this.patch({ status: error ? "error" : "stopped", error });
  }

  private terminal(status: "error" | "stopped", error: string | null = null): void {
    const generation = ++this.generation;
    this.detach();
    this.patch({ status, sessionId: null, error });
    void this.closeTransport().then((cleanupError) => {
      if (this.current(generation) && cleanupError && status !== "error") {
        this.patch({ status: "error", error: cleanupError });
      }
    });
  }

  private closeTransport(): Promise<string | null> {
    if (this.cleanupTask) return this.cleanupTask;
    const task = Promise.resolve()
      .then(() => this.transport.stop())
      .then(
        () => null,
        (error: unknown) => this.errorMessage(error, "Unable to stop realtime audio."),
      );
    this.cleanupTask = task;
    void task.then(() => {
      if (this.cleanupTask === task) this.cleanupTask = null;
    });
    return task;
  }

  private detach(): void {
    const unsubscribe = this.unsubscribeTransport;
    this.unsubscribeTransport = null;
    unsubscribe?.();
  }

  private current(generation: number): boolean {
    return !this.disposed && this.generation === generation;
  }

  private updateTranscript(item: RealtimeTranscriptItem, completed: boolean): void {
    const index = this.state.transcript.findIndex((entry) => entry.id === item.id);
    const previous = this.state.transcript[index];
    if (previous?.completed && !completed) return;
    const entry = {
      id: item.id,
      role: item.role,
      text: item.text.slice(-MAX_TRANSCRIPT_TEXT),
      completed,
    };
    const transcript = [...this.state.transcript];
    if (index === -1) transcript.push(entry);
    else transcript[index] = entry;
    this.patch({ transcript: transcript.slice(-MAX_TRANSCRIPT_ITEMS) });
  }

  private errorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
  }

  private patch(patch: Partial<RealtimeState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener(this.state));
  }
}
