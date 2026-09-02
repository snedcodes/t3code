import type { ProviderRealtimeAudioChunk, ThreadId } from "@t3tools/contracts";
import type { RealtimeState } from "@t3tools/client-runtime/state/realtime";
export type VoiceStatus = "idle" | "starting" | "active" | "stopping" | "stopped" | "error";
export type PcmFrame = Readonly<{ data: string; sampleRate: number; numChannels: number }>;
export type VoiceState = Readonly<{
  status: VoiceStatus;
  sessionId: string | null;
  micMuted: boolean;
  assistantMuted: boolean;
  error: string | null;
}>;
const MAX_FRAME_BYTES = 32_000;
export interface VoiceTransport {
  start(): Promise<void>;
  appendAudio(frame: PcmFrame): Promise<void>;
  stop(): Promise<void>;
  setMicMuted?(muted: boolean): void;
  setAssistantMuted?(muted: boolean): void;
  onStarted(listener: (id: string) => void): () => void;
  onAudio(listener: (audio: ProviderRealtimeAudioChunk) => void): () => void;
  onError(listener: (message: string) => void): () => void;
  onClosed(listener: () => void): () => void;
}
export interface PcmPlayer {
  play(chunk: ProviderRealtimeAudioChunk): void;
  stop(): void;
}
export interface RealtimeBootstrapResponse {
  readonly value?: string;
  readonly expires_at?: number;
  readonly client_secret?: Readonly<{ readonly value?: string }>;
}
export interface RealtimeEndpointBinding {
  readonly path: string;
  readonly fetchBootstrap?: (input: {
    readonly environmentId: string;
    readonly projectId?: string;
    readonly threadId: ThreadId;
  }) => Promise<RealtimeBootstrapResponse>;
}
export const REALTIME_BOOTSTRAP_ENDPOINT = "/v1/realtime/client_secrets";
const REALTIME_WEBRTC_ENDPOINT = "https://api.openai.com/v1/realtime/calls";
export class RealtimeVoiceController {
  private state: VoiceState = {
    status: "idle",
    sessionId: null,
    micMuted: false,
    assistantMuted: false,
    error: null,
  };
  private readonly listeners = new Set<(state: VoiceState) => void>();
  private readonly unsubscribers: ReadonlyArray<() => void>;
  private observedAudioCount = 0;
  constructor(
    private readonly threadId: ThreadId,
    private readonly transport: VoiceTransport,
    private readonly player: PcmPlayer,
  ) {
    this.unsubscribers = [
      transport.onStarted((sessionId) => this.patch({ status: "active", sessionId, error: null })),
      transport.onAudio((audio) => {
        if (this.state.status === "active" && !this.state.assistantMuted) this.player.play(audio);
      }),
      transport.onError((error) => this.patch({ status: "error", error })),
      transport.onClosed(() => {
        this.player.stop();
        this.patch({ status: "stopped" });
      }),
    ];
  }
  getState(): VoiceState {
    return this.state;
  }
  subscribe(listener: (state: VoiceState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }
  applyRealtimeState(state: RealtimeState): void {
    if (state.threadId !== this.threadId) return;
    if (state.audio.length < this.observedAudioCount) this.observedAudioCount = 0;
    const newAudio = state.audio.slice(this.observedAudioCount);
    this.observedAudioCount = state.audio.length;
    if (state.status === "active" && this.state.status !== "stopping") {
      this.patch({ status: "active", sessionId: state.realtimeSessionId ?? null, error: null });
      if (!this.state.assistantMuted) newAudio.forEach((chunk) => this.player.play(chunk));
    } else if (state.status === "error")
      this.patch({ status: "error", error: state.error ?? "Realtime Voice failed." });
    else if (state.status === "stopped") {
      this.player.stop();
      this.patch({ status: "stopped" });
    }
  }
  async start(): Promise<void> {
    if (this.state.status === "starting" || this.state.status === "active") return;
    this.patch({ status: "starting", error: null });
    try {
      await this.transport.start();
    } catch (error) {
      this.patch({
        status: "error",
        error: error instanceof Error ? error.message : "Unable to start Voice.",
      });
    }
  }
  async submitFrame(frame: PcmFrame): Promise<boolean> {
    if (
      this.state.status !== "active" ||
      this.state.micMuted ||
      frame.data.length > MAX_FRAME_BYTES
    )
      return false;
    try {
      await this.transport.appendAudio(frame);
      return true;
    } catch (error) {
      this.patch({
        status: "error",
        error: error instanceof Error ? error.message : "Unable to send microphone audio.",
      });
      return false;
    }
  }
  setMicMuted(muted: boolean): void {
    this.transport.setMicMuted?.(muted);
    this.patch({ micMuted: muted });
  }
  setAssistantMuted(muted: boolean): void {
    this.transport.setAssistantMuted?.(muted);
    this.patch({ assistantMuted: muted });
    if (muted) this.player.stop();
  }
  async stop(): Promise<void> {
    if (this.state.status === "idle" || this.state.status === "stopped") return;
    this.patch({ status: "stopping" });
    this.player.stop();
    await this.transport.stop();
  }
  dispose(): void {
    this.player.stop();
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
  }
  private patch(patch: Partial<VoiceState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener(this.state));
  }
}
export function createWebRtcAudioPlayer(): PcmPlayer {
  return { play: () => undefined, stop: () => undefined };
}
export function createBrowserRealtimeTransport(input: {
  readonly environmentId: string;
  readonly projectId: string;
  readonly threadId: ThreadId;
  readonly endpoint?: RealtimeEndpointBinding;
}): VoiceTransport {
  const endpoint = input.endpoint ?? { path: REALTIME_BOOTSTRAP_ENDPOINT };
  const started = new Set<(id: string) => void>();
  const errors = new Set<(message: string) => void>();
  const closed = new Set<() => void>();
  let pc: RTCPeerConnection | null = null;
  let dc: RTCDataChannel | null = null;
  let stream: MediaStream | null = null;
  let output: HTMLAudioElement | null = null;
  const bootstrap =
    endpoint.fetchBootstrap ??
    (async () => {
      const response = await fetch(endpoint.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId: input.threadId,
          projectId: input.projectId,
          session: {
            type: "realtime",
            model: "gpt-realtime-2",
            audio: {
              output: { voice: "marin" },
              input: {
                turn_detection: {
                  type: "semantic_vad",
                  eagerness: "low",
                  create_response: true,
                  interrupt_response: true,
                },
              },
            },
          },
          expires_after: { anchor: "created_at", seconds: 900 },
        }),
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json() as Promise<RealtimeBootstrapResponse>;
    });
  return {
    async start() {
      const data = await bootstrap({
        environmentId: input.environmentId,
        projectId: input.projectId,
        threadId: input.threadId,
      });
      const token = data.value ?? data.client_secret?.value;
      if (!token)
        throw new Error("Native T3 realtime bootstrap returned no ephemeral client secret.");
      pc = new RTCPeerConnection();
      output = document.createElement("audio");
      output.autoplay = true;
      pc.ontrack = (event) => {
        if (output) output.srcObject = event.streams[0]!;
      };
      stream = await requestMicrophone();
      stream.getTracks().forEach((track) => pc?.addTrack(track, stream!));
      dc = pc.createDataChannel("oai-events");
      dc.addEventListener("message", (event) => {
        try {
          const value = JSON.parse(String(event.data)) as {
            readonly type?: string;
            readonly session?: { readonly id?: string };
            readonly error?: { readonly message?: string };
          };
          if (value.type === "session.created")
            started.forEach((listener) => listener(value.session?.id ?? ""));
          else if (value.type === "error")
            errors.forEach((listener) =>
              listener(value.error?.message ?? "Realtime session error."),
            );
        } catch {
          errors.forEach((listener) => listener("Unable to parse realtime event."));
        }
      });
      pc.onconnectionstatechange = () => {
        if (pc?.connectionState === "failed")
          errors.forEach((listener) => listener("Realtime connection failed."));
        if (pc?.connectionState === "closed" || pc?.connectionState === "disconnected")
          closed.forEach((listener) => listener());
      };
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const response = await fetch(REALTIME_WEBRTC_ENDPOINT, {
        method: "POST",
        body: offer.sdp ?? "",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/sdp" },
      });
      if (!response.ok) throw new Error(await response.text());
      await pc.setRemoteDescription({ type: "answer", sdp: await response.text() });
    },
    appendAudio: async () => undefined,
    async stop() {
      if (dc?.readyState === "open") dc.send(JSON.stringify({ type: "response.cancel" }));
      dc?.close();
      pc?.close();
      stream?.getTracks().forEach((track) => track.stop());
      output?.pause();
      if (output) output.srcObject = null;
      closed.forEach((listener) => listener());
      dc = null;
      pc = null;
      stream = null;
      output = null;
    },
    setMicMuted(muted) {
      stream?.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    },
    setAssistantMuted(muted) {
      if (output) output.muted = muted;
    },
    onStarted(listener) {
      started.add(listener);
      return () => started.delete(listener);
    },
    onAudio: () => () => undefined,
    onError(listener) {
      errors.add(listener);
      return () => errors.delete(listener);
    },
    onClosed(listener) {
      closed.add(listener);
      return () => closed.delete(listener);
    },
  };
}
export async function requestMicrophone(): Promise<MediaStream> {
  if (!window.isSecureContext)
    throw new Error("Microphone capture requires a secure browser context.");
  if (!navigator.mediaDevices?.getUserMedia)
    throw new Error("This browser does not expose microphone capture.");
  return navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
  });
}
