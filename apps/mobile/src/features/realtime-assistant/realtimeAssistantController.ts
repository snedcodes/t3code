export type AssistantStatus =
  | "idle"
  | "starting"
  | "active"
  | "reconnecting"
  | "stopping"
  | "stopped"
  | "error";

export type RealtimeTerminalReason =
  | "peer-failed"
  | "channel-failed"
  | "connection-closed"
  | "network-failed"
  | "startup-failed"
  | "session-error";

export interface RealtimeRecoveryOptions {
  /** Resolve only while the call's microphone foreground service is active. */
  beforeReconnect?: (signal: AbortSignal) => Promise<void>;
  /** Call intent survives per-session cleanup; false releases the call's native owner. */
  onCallIntentChanged?: (requested: boolean) => void;
}

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
  readonly portfolioAccess?: boolean;
  readonly documentBudgetBytes?: number;
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
    error(message: string, reason?: RealtimeTerminalReason): void;
    closed(reason?: RealtimeTerminalReason): void;
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
const RECONNECT_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 16_000, 30_000] as const;

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
  private callRequested = false;
  private callContext: RealtimeStartContext = {};
  private retries = 0;
  private recoveryAbort: AbortController | null = null;

  constructor(
    target: RealtimeTarget,
    private readonly transport: RealtimeTransport,
    private readonly recovery: RealtimeRecoveryOptions = {},
  ) {
    this.target = Object.freeze({ projectId: target.projectId, threadId: target.threadId });
  }

  getState(): RealtimeState {
    return this.state;
  }

  isCallRequested(): boolean {
    return this.callRequested;
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
    if (this.disposed || this.callRequested) return;
    const generation = ++this.generation;
    const previousStart = this.startTask;
    const context: RealtimeStartContext = {
      ...(input.portfolioAccess === undefined ? {} : { portfolioAccess: input.portfolioAccess }),
      ...(input.documentBudgetBytes === undefined
        ? {}
        : { documentBudgetBytes: input.documentBudgetBytes }),
      ...(input.selectedMessageId === undefined
        ? {}
        : { selectedMessageId: input.selectedMessageId }),
      ...(input.documentPaths === undefined ? {} : { documentPaths: [...input.documentPaths] }),
    };
    this.callContext = context;
    this.retries = 0;
    this.setCallIntent(true);
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
      this.terminal("error", cleanupError);
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
        error: (message, reason) => {
          if (this.current(generation)) this.connectionEnded("error", message, reason);
        },
        closed: (reason) => {
          if (this.current(generation)) this.connectionEnded("stopped", null, reason);
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
      this.patch({ status: "active", sessionId, error: null });
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
    this.cancelRecovery();
    this.setCallIntent(false);
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
    this.cancelRecovery();
    this.setCallIntent(false);
    this.detach();
    this.patch({ status: "stopping", sessionId: null });
    this.listeners.clear();
    const error = await this.closeTransport();
    this.patch({ status: error ? "error" : "stopped", error });
  }

  private terminal(status: "error" | "stopped", error: string | null = null): void {
    const generation = ++this.generation;
    this.cancelRecovery();
    this.setCallIntent(false);
    this.detach();
    this.patch({ status, sessionId: null, error });
    void this.closeTransport().then((cleanupError) => {
      if (this.current(generation) && cleanupError && status !== "error") {
        this.patch({ status: "error", error: cleanupError });
      }
    });
  }

  private connectionEnded(
    status: "error" | "stopped",
    error: string | null,
    reason?: RealtimeTerminalReason,
  ): void {
    const reconnectable =
      reason === "peer-failed" ||
      reason === "channel-failed" ||
      reason === "connection-closed" ||
      reason === "network-failed";
    const delay = RECONNECT_DELAYS_MS[this.retries]!;
    if (!this.callRequested || !this.recovery.beforeReconnect || !reconnectable) {
      this.terminal(status, error);
      return;
    }
    this.retries = Math.min(this.retries + 1, RECONNECT_DELAYS_MS.length - 1);
    const generation = ++this.generation;
    const previousStart = this.startTask;
    this.cancelRecovery();
    const abort = new AbortController();
    this.recoveryAbort = abort;
    this.detach();
    const cleanup = this.closeTransport();
    this.patch({ status: "reconnecting", sessionId: null, error: null });
    const task = this.reconnect(generation, previousStart, cleanup, delay, abort);
    this.startTask = task;
    void task.then(() => {
      if (this.startTask === task) this.startTask = null;
    });
  }

  private async reconnect(
    generation: number,
    previousStart: Promise<void> | null,
    cleanup: Promise<string | null>,
    delay: number,
    abort: AbortController,
  ): Promise<void> {
    await previousStart;
    const cleanupError = await cleanup;
    if (!this.current(generation)) return;
    if (cleanupError) {
      this.terminal("error", cleanupError);
      return;
    }
    // Abort resolves both backoff and readiness waits; a late native gate cannot open a mic.
    let cancel!: () => void;
    const cancelled = new Promise<false>((resolve) => {
      cancel = () => resolve(false);
    });
    abort.signal.addEventListener("abort", cancel, { once: true });
    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
      if (abort.signal.aborted || !this.current(generation)) return;
      const elapsed = new Promise<true>((resolve) => {
        timer = setTimeout(() => resolve(true), delay);
      });
      if (!(await Promise.race([elapsed, cancelled])) || !this.current(generation)) return;
      if (timer !== null) clearTimeout(timer);
      timer = null;
      const ready = this.recovery.beforeReconnect!(abort.signal).then(() => true as const);
      if (!(await Promise.race([ready, cancelled])) || !this.current(generation)) return;
      await this.begin(generation, null, this.callContext);
    } catch {
      if (this.current(generation))
        this.terminal("error", "Unable to prepare realtime reconnection.");
    } finally {
      if (timer !== null) clearTimeout(timer);
      abort.signal.removeEventListener("abort", cancel);
      if (this.recoveryAbort === abort) this.recoveryAbort = null;
    }
  }

  private cancelRecovery(): void {
    this.recoveryAbort?.abort();
    this.recoveryAbort = null;
  }

  private setCallIntent(requested: boolean): void {
    if (this.callRequested === requested) return;
    this.callRequested = requested;
    try {
      this.recovery.onCallIntentChanged?.(requested);
    } catch {
      // A native notification callback must not prevent cancellation or audio cleanup.
    }
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
