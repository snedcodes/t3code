import type {
  ProviderRealtimeAudioChunk,
  ProviderRealtimeStartInput,
  ThreadId,
} from "@t3tools/contracts";

export type AssistantStatus = "idle" | "starting" | "active" | "stopping" | "stopped" | "error";
export interface PcmFrame {
  readonly data: string;
  readonly sampleRate: number;
  readonly numChannels: number;
}
export interface RealtimeTransport {
  start(input: ProviderRealtimeStartInput): Promise<void>;
  appendAudio(frame: PcmFrame): Promise<void>;
  stop(): Promise<void>;
  onStarted(listener: (sessionId: string) => void): () => void;
  onItemAdded(listener: (item: unknown) => void): () => void;
  onAudio(listener: (audio: ProviderRealtimeAudioChunk) => void): () => void;
  onError(listener: (message: string) => void): () => void;
  onClosed(listener: () => void): () => void;
}
export interface PcmPlayer {
  play(chunk: ProviderRealtimeAudioChunk): void;
  stop(): void;
}
export interface RealtimeState {
  readonly status: AssistantStatus;
  readonly sessionId: string | null;
  readonly micMuted: boolean;
  readonly assistantMuted: boolean;
  readonly items: ReadonlyArray<unknown>;
  readonly error: string | null;
}
const MAX_FRAME_BYTES = 32_000;
export class RealtimeAssistantController {
  private state: RealtimeState = {
    status: "idle",
    sessionId: null,
    micMuted: false,
    assistantMuted: false,
    items: [],
    error: null,
  };
  private readonly listeners = new Set<(state: RealtimeState) => void>();
  private readonly unsubscribers: ReadonlyArray<() => void>;
  private captureBlockedUntil = 0;
  constructor(
    private readonly threadId: ThreadId,
    private readonly transport: RealtimeTransport,
    private readonly player: PcmPlayer,
  ) {
    this.unsubscribers = [
      transport.onStarted((sessionId) => {
        this.captureBlockedUntil = Date.now() + STARTUP_CAPTURE_GATE_MS;
        this.patch({ status: "active", sessionId, error: null });
      }),
      transport.onItemAdded((item) => this.patch({ items: [...this.state.items, item] })),
      transport.onAudio((audio) => this.playAudio(audio)),
      transport.onError((message) => this.patch({ status: "error", error: message })),
      transport.onClosed(() => this.patch({ status: "stopped" })),
    ];
  }
  getState(): RealtimeState {
    return this.state;
  }
  subscribe(listener: (state: RealtimeState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }
  async start(input: Omit<ProviderRealtimeStartInput, "threadId"> = {}): Promise<void> {
    if (this.state.status === "starting" || this.state.status === "active") return;
    this.patch({ status: "starting", error: null });
    try {
      await this.transport.start({ threadId: this.threadId, ...input });
    } catch (error) {
      this.patch({
        status: "error",
        error: error instanceof Error ? error.message : "Unable to start realtime audio.",
      });
    }
  }
  async submitFrame(frame: PcmFrame): Promise<boolean> {
    if (
      this.state.status !== "active" ||
      this.state.micMuted ||
      Date.now() < this.captureBlockedUntil ||
      frame.data.length > MAX_FRAME_BYTES
    )
      return false;
    try {
      await this.transport.appendAudio(frame);
      return true;
    } catch (error) {
      this.reportError(error instanceof Error ? error.message : "Unable to send microphone audio.");
      return false;
    }
  }
  setMicMuted(muted: boolean): void {
    this.patch({ micMuted: muted });
  }
  reportError(message: string): void {
    this.patch({ status: "error", error: message });
  }
  setAssistantMuted(muted: boolean): void {
    this.patch({ assistantMuted: muted });
    if (muted) this.player.stop();
  }
  async stop(): Promise<void> {
    if (this.state.status === "idle" || this.state.status === "stopped") return;
    this.patch({ status: "stopping" });
    this.player.stop();
    await this.transport.stop();
    this.patch({ status: "stopped" });
  }
  dispose(): void {
    this.player.stop();
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
  }
  private playAudio(audio: ProviderRealtimeAudioChunk): void {
    if (!this.state.assistantMuted && this.state.status === "active") {
      this.captureBlockedUntil = Date.now() + PLAYBACK_CAPTURE_GATE_MS;
      this.player.play(audio);
    }
  }
  private patch(patch: Partial<RealtimeState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener(this.state));
  }
}

export const STARTUP_CAPTURE_GATE_MS = 900;
export const PLAYBACK_CAPTURE_GATE_MS = 450;
