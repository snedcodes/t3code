import type { ProviderRealtimeAudioChunk, ProviderRealtimeStartInput, ThreadId } from "@t3tools/contracts";

export type VoiceStatus = "idle" | "starting" | "active" | "stopping" | "stopped" | "error";
export type PcmFrame = Readonly<{ data: string; sampleRate: number; numChannels: number }>;
export type VoiceState = Readonly<{ status: VoiceStatus; sessionId: string | null; micMuted: boolean; assistantMuted: boolean; error: string | null }>;
const MAX_FRAME_BYTES = 32_000;
export interface VoiceTransport { start(input: ProviderRealtimeStartInput): Promise<void>; appendAudio(frame: PcmFrame): Promise<void>; stop(): Promise<void>; onStarted(listener: (sessionId: string) => void): () => void; onAudio(listener: (audio: ProviderRealtimeAudioChunk) => void): () => void; onError(listener: (message: string) => void): () => void; onClosed(listener: () => void): () => void }
export interface PcmPlayer { play(chunk: ProviderRealtimeAudioChunk): void; stop(): void }
export interface T3RealtimeCommandAdapter {
  start(input: ProviderRealtimeStartInput): Promise<void>;
  appendAudio(input: { threadId: ThreadId; audio: PcmFrame }): Promise<void>;
  stop(input: { threadId: ThreadId }): Promise<void>;
}

export class RealtimeVoiceController {
  private state: VoiceState = { status: "idle", sessionId: null, micMuted: false, assistantMuted: false, error: null };
  private readonly listeners = new Set<(state: VoiceState) => void>();
  private readonly unsubscribers: ReadonlyArray<() => void>;
  constructor(private readonly threadId: ThreadId, private readonly transport: VoiceTransport, private readonly player: PcmPlayer) {
    this.unsubscribers = [transport.onStarted((sessionId) => this.patch({ status: "active", sessionId, error: null })), transport.onAudio((audio) => { if (this.state.status === "active" && !this.state.assistantMuted) this.player.play(audio); }), transport.onError((error) => this.patch({ status: "error", error })), transport.onClosed(() => this.patch({ status: "stopped" }))];
  }
  getState(): VoiceState { return this.state; }
  subscribe(listener: (state: VoiceState) => void): () => void { this.listeners.add(listener); listener(this.state); return () => this.listeners.delete(listener); }
  async start(input: Omit<ProviderRealtimeStartInput, "threadId"> = {}): Promise<void> { if (this.state.status === "starting" || this.state.status === "active") return; this.patch({ status: "starting", error: null }); try { await this.transport.start({ threadId: this.threadId, ...input }); } catch (error) { this.patch({ status: "error", error: error instanceof Error ? error.message : "Unable to start Voice." }); } }
  async submitFrame(frame: PcmFrame): Promise<boolean> { if (this.state.status !== "active" || this.state.micMuted || frame.data.length > MAX_FRAME_BYTES) return false; try { await this.transport.appendAudio(frame); return true; } catch (error) { this.patch({ status: "error", error: error instanceof Error ? error.message : "Unable to send microphone audio." }); return false; } }
  setMicMuted(muted: boolean): void { this.patch({ micMuted: muted }); }
  setAssistantMuted(muted: boolean): void { this.patch({ assistantMuted: muted }); if (muted) this.player.stop(); }
  async stop(): Promise<void> { if (this.state.status === "idle" || this.state.status === "stopped") return; this.patch({ status: "stopping" }); this.player.stop(); await this.transport.stop(); }
  dispose(): void { this.player.stop(); this.unsubscribers.forEach((unsubscribe) => unsubscribe()); }
  private patch(patch: Partial<VoiceState>): void { this.state = { ...this.state, ...patch }; this.listeners.forEach((listener) => listener(this.state)); }
}

function decodePcm16(data: string): Int16Array { const bytes = Uint8Array.from(atob(data), (character) => character.charCodeAt(0)); const samples = new Int16Array(Math.floor(bytes.byteLength / 2)); const view = new DataView(bytes.buffer); for (let index = 0; index < samples.length; index += 1) samples[index] = view.getInt16(index * 2, true); return samples; }
export function createAudioContextPlayer(context: AudioContext): PcmPlayer { let nextStart = 0; return { play(chunk) { const samples = decodePcm16(chunk.data); const buffer = context.createBuffer(chunk.numChannels, samples.length / chunk.numChannels, chunk.sampleRate); for (let channel = 0; channel < chunk.numChannels; channel += 1) { const output = buffer.getChannelData(channel); for (let index = channel; index < samples.length; index += chunk.numChannels) output[Math.floor(index / chunk.numChannels)] = samples[index]! / 32768; } const source = context.createBufferSource(); source.buffer = buffer; source.connect(context.destination); nextStart = Math.max(nextStart, context.currentTime); source.start(nextStart); nextStart += buffer.duration; }, stop() { nextStart = context.currentTime; } }; }
export function createT3VoiceTransport(threadId: ThreadId, commands: T3RealtimeCommandAdapter): VoiceTransport {
  const started = new Set<(sessionId: string) => void>(); const audio = new Set<(chunk: ProviderRealtimeAudioChunk) => void>(); const errors = new Set<(message: string) => void>(); const closed = new Set<() => void>();
  return {
    start: async (input) => { if (input.threadId !== threadId) throw new Error("Realtime start thread identity changed."); await commands.start(input); },
    appendAudio: (frame) => commands.appendAudio({ threadId, audio: frame }),
    stop: () => commands.stop({ threadId }),
    onStarted(listener) { started.add(listener); return () => started.delete(listener); },
    onAudio(listener) { audio.add(listener); return () => audio.delete(listener); },
    onError(listener) { errors.add(listener); return () => errors.delete(listener); },
    onClosed(listener) { closed.add(listener); return () => closed.delete(listener); },
  };
}
export async function requestMicrophone(): Promise<MediaStream> { if (!navigator.mediaDevices?.getUserMedia) throw new Error("This browser does not expose microphone capture."); return navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } }); }
