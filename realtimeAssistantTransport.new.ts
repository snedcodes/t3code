import type { ProviderRealtimeAudioChunk, ProviderRealtimeStartInput } from "@t3tools/contracts";
import type { PcmFrame, RealtimeTransport } from "./realtimeAssistantController";

export interface RealtimeClientSecretBootstrap {
  readonly threadId: string;
  readonly projectId: string;
  readonly session?: Record<string, unknown>;
}

type Listener<T extends (...args: never[]) => void> = T;

const SAMPLE_RATE = 24_000;

/** Direct OpenAI Realtime transport. The T3 server is used only to mint the
 * ephemeral client secret; the phone owns the realtime WebSocket and PCM path. */
export function createOpenAiRealtimeTransport(input: {
  readonly bootstrap: (request: RealtimeClientSecretBootstrap) => Promise<Record<string, unknown>>;
  readonly threadId: string;
  readonly projectId: string;
}): RealtimeTransport {
  let socket: WebSocket | null = null;
  let stopped = true;
  let responseActive = false;
  let started: Listener<(sessionId: string) => void> = () => undefined;
  let itemAdded: Listener<(item: unknown) => void> = () => undefined;
  let audio: Listener<(chunk: ProviderRealtimeAudioChunk) => void> = () => undefined;
  let error: Listener<(message: string) => void> = () => undefined;
  let closed: Listener<() => void> = () => undefined;

  const send = (message: Record<string, unknown>) => {
    if (socket?.readyState !== 1) throw new Error("Realtime connection is not open.");
    socket.send(JSON.stringify(message));
  };
  const fail = (message: string) => { if (!stopped) error(message); };

  return {
    async start(sessionInput: ProviderRealtimeStartInput) {
      stopped = false;
      const secretResponse = await input.bootstrap({
        threadId: input.threadId,
        projectId: input.projectId,
        session: { model: "gpt-realtime-2", ...sessionInput },
      });
      const secret = (secretResponse.client_secret as { value?: unknown } | undefined)?.value;
      if (typeof secret !== "string" || secret.length === 0) throw new Error("T3 realtime bootstrap returned no client secret.");
      const model = typeof secretResponse.model === "string" ? secretResponse.model : "gpt-realtime-2";
      const url = typeof secretResponse.websocket_url === "string"
        ? secretResponse.websocket_url
        : `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`;
      await new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(url, undefined, { headers: { Authorization: `Bearer ${secret}` } } as never);
        socket = ws;
        ws.onopen = () => {
          try {
            send({ type: "session.update", session: {
              type: "realtime",
              model,
              output_modalities: ["audio"],
              audio: {
                input: { format: { type: "audio/pcm", rate: SAMPLE_RATE }, noise_reduction: { type: "near_field" }, turn_detection: { type: "semantic_vad", eagerness: "low" } },
                output: { format: { type: "audio/pcm", rate: SAMPLE_RATE }, voice: "marin" },
              },
              metadata: { t3_thread_id: input.threadId, t3_project_id: input.projectId },
            } });
            resolve();
          } catch (cause) { reject(cause); }
        };
        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(String(event.data)) as Record<string, unknown>;
            const type = message.type;
            if (type === "session.created" || type === "session.updated") {
              const session = (message.session ?? {}) as Record<string, unknown>;
              started(typeof session.id === "string" ? session.id : "realtime");
            } else if (type === "response.created") responseActive = true;
            else if (type === "response.done") responseActive = false;
            else if (type === "response.output_audio.delta" || type === "response.audio.delta") {
              const delta = message.delta;
              if (typeof delta === "string") audio({ data: delta, sampleRate: SAMPLE_RATE, numChannels: 1 });
            } else if (type === "response.audio_transcript.delta" || type === "response.output_audio_transcript.delta") itemAdded(message);
            else if (type === "input_audio_buffer.speech_started") {
              if (responseActive) { try { send({ type: "response.cancel" }); } catch { /* socket is closing */ } }
              responseActive = false;
            } else if (type === "error") {
              const detail = (message.error as Record<string, unknown> | undefined)?.message;
              fail(typeof detail === "string" ? detail : "OpenAI realtime error.");
            }
          } catch (cause) { fail(cause instanceof Error ? cause.message : "Invalid realtime event."); }
        };
        ws.onerror = () => { const message = "OpenAI realtime connection failed."; fail(message); reject(new Error(message)); };
        ws.onclose = () => { socket = null; responseActive = false; if (!stopped) closed(); };
      });
    },
    async appendAudio(frame: PcmFrame) {
      send({ type: "input_audio_buffer.append", audio: frame.data });
    },
    async stop() {
      stopped = true;
      responseActive = false;
      const ws = socket;
      socket = null;
      if (ws?.readyState === 1) { try { ws.send(JSON.stringify({ type: "response.cancel" })); } catch { /* cleanup */ } ws.close(1000, "client stop"); }
    },
    onStarted(listener) { started = listener; return () => { if (started === listener) started = () => undefined; }; },
    onItemAdded(listener) { itemAdded = listener; return () => { if (itemAdded === listener) itemAdded = () => undefined; }; },
    onAudio(listener) { audio = listener; return () => { if (audio === listener) audio = () => undefined; }; },
    onError(listener) { error = listener; return () => { if (error === listener) error = () => undefined; }; },
    onClosed(listener) { closed = listener; return () => { if (closed === listener) closed = () => undefined; }; },
  };
}
