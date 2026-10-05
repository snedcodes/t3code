export type RealtimeCallControl = { ownerId: string; reason: "user-stop" | "service-ended" };
export interface RealtimeCallNative {
  start(ownerId: string): Promise<boolean>;
  stop(ownerId: string): void;
  isActive(ownerId: string): boolean;
  subscribe(listener: (event: RealtimeCallControl) => void): () => void;
}

/** One sheet owns one native call; background/reconnect only check its existing service. */
export class RealtimeCallLifetime {
  private ownerId: string | null = null;
  private generation = 0;
  private unsubscribe: (() => void) | null = null;
  constructor(
    private readonly options: {
      native: RealtimeCallNative;
      identity(): string;
      foreground(): boolean;
      microphonePermission(): Promise<boolean>;
      onEnd(reason: RealtimeCallControl["reason"]): void;
    },
  ) {}

  async start(): Promise<void> {
    if (this.ownerId) throw new Error("A voice call is already owned by this panel.");
    if (!this.options.foreground()) throw new Error("Start voice while the app is visible.");
    const generation = ++this.generation;
    const token = this.options.identity();
    this.ownerId = token;
    try {
      if (!(await this.options.microphonePermission())) throw new Error();
      if (generation !== this.generation || !this.options.foreground()) throw new Error();
      this.unsubscribe = this.options.native.subscribe((event) => {
        if (event.ownerId === this.ownerId) this.options.onEnd(event.reason);
      });
      const started = await this.options.native.start(token);
      if (!started || generation !== this.generation) throw new Error();
    } catch {
      if (this.ownerId === token) this.end();
      else this.options.native.stop(token);
      throw new Error(
        "Voice requires microphone permission and the updated Android background-call service. Start while the app is visible.",
      );
    }
  }

  beforeReconnect = async (signal: AbortSignal): Promise<void> => {
    if (signal.aborted || !this.ownerId || !this.options.native.isActive(this.ownerId)) {
      throw new Error("The Android background-call service is no longer active.");
    }
    // No permission prompt, foreground check or new service start during recovery.
  };

  end(): void {
    ++this.generation;
    const token = this.ownerId;
    this.ownerId = null;
    this.unsubscribe?.();
    this.unsubscribe = null;
    if (token) this.options.native.stop(token);
  }
}
