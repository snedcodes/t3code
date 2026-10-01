// oxlint-disable unicorn/prefer-add-event-listener -- Injected native peers expose single owned callbacks, cleared during teardown.
import type { RealtimeClientSecretResponse } from "@t3tools/contracts";
import type { RealtimeTranscriptItem, RealtimeTransport } from "./realtimeAssistantController";

export interface VoiceTrack {
  enabled: boolean;
  stop(): void;
}
export interface VoiceStream {
  getTracks(): VoiceTrack[];
  getAudioTracks(): VoiceTrack[];
}
export interface VoiceDataChannel {
  readonly readyState: string;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: (() => void) | null;
  onerror: (() => void) | null;
  send(data: string): void;
  close(): void;
}
export interface VoicePeer {
  readonly connectionState: string;
  ontrack: ((event: { streams: VoiceStream[] }) => void) | null;
  onconnectionstatechange: (() => void) | null;
  addTrack(track: VoiceTrack, stream: VoiceStream): unknown;
  createDataChannel(label: string): VoiceDataChannel;
  createOffer(): Promise<{ type: "offer"; sdp?: string }>;
  setLocalDescription(description: { type: "offer"; sdp: string }): Promise<void>;
  setRemoteDescription(description: { type: "answer"; sdp: string }): Promise<void>;
  close(): void;
}
export interface RealtimeVoicePlatform {
  createPeerConnection(): VoicePeer;
  getUserMedia(constraints: { audio: true }): Promise<VoiceStream>;
  fetch(
    url: string,
    init: {
      method: "POST";
      headers: { Authorization: string; "Content-Type": "application/sdp" };
      body: string;
      signal: AbortSignal;
    },
  ): Promise<{ ok: boolean; status: number; text(): Promise<string> }>;
  playback: {
    setRemoteStream(stream: VoiceStream | null): void;
    setMuted(muted: boolean): void;
    /** Flush current audio without preventing playback of the next response. */
    clear(): void;
  };
}

type StartInput = Parameters<RealtimeTransport["start"]>[0];
type Listeners = Parameters<RealtimeTransport["subscribe"]>[0];

export interface RealtimeContextTools {
  sources(): Promise<unknown>;
  read(input: Record<string, unknown>): Promise<unknown>;
}

class RealtimeTransportError extends Error {}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  // Events can reject these before negotiation starts awaiting them.
  void promise.catch(() => {});
  return { promise, resolve, reject };
}
function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

/** Direct WebRTC media; the authenticated T3 caller supplies only an ephemeral secret. */
export function createOpenAiRealtimeTransport(options: {
  bootstrap(request: StartInput): Promise<RealtimeClientSecretResponse>;
  platform: RealtimeVoicePlatform;
  startTimeoutMs?: number;
  contextTools?: RealtimeContextTools;
}): RealtimeTransport {
  const { platform } = options;
  const listeners = new Set<Listeners>();
  let micMuted = false;
  let assistantMuted = false;
  let current: ReturnType<typeof attempt> | null = null;

  function attempt() {
    return {
      abort: new AbortController(),
      cancelled: deferred<never>(),
      created: deferred<string>(),
      peer: null as VoicePeer | null,
      channel: null as VoiceDataChannel | null,
      local: null as VoiceStream | null,
      remote: null as VoiceStream | null,
      timer: null as ReturnType<typeof setTimeout> | null,
      transcripts: new Map<string, RealtimeTranscriptItem & { completed: boolean }>(),
      responseActive: false,
      portfolioAccess: true,
      calls: new Set<string>(),
      pendingTools: 0,
      toolGeneration: 0,
      resumeRequested: false,
    };
  }
  type Attempt = ReturnType<typeof attempt>;
  const live = (session: Attempt) => current === session && !session.abort.signal.aborted;
  const ensureLive = (session: Attempt) => {
    if (!live(session)) throw new RealtimeTransportError("Realtime session stopped.");
  };
  const wait = <T>(session: Attempt, promise: Promise<T>): Promise<T> =>
    Promise.race([promise, session.cancelled.promise]);
  const bestEffort = (action: () => void) => {
    try {
      action();
    } catch {
      /* Continue releasing other resources. */
    }
  };
  function stopTracks(stream: VoiceStream | null) {
    bestEffort(() => stream?.getTracks().forEach((track) => bestEffort(() => track.stop())));
  }
  function cleanup(session: Attempt, reason: Error) {
    if (current === session) current = null;
    if (session.timer !== null) clearTimeout(session.timer);
    session.timer = null;
    session.cancelled.reject(reason);
    session.created.reject(reason);
    session.abort.abort();
    if (session.channel) {
      session.channel.onmessage = null;
      session.channel.onclose = null;
      session.channel.onerror = null;
      bestEffort(() => session.channel?.close());
    }
    if (session.peer) {
      session.peer.ontrack = null;
      session.peer.onconnectionstatechange = null;
      bestEffort(() => session.peer?.close());
    }
    stopTracks(session.local);
    stopTracks(session.remote);
    session.local = null;
    session.remote = null;
    session.transcripts.clear();
    session.calls.clear();
    bestEffort(() => platform.playback.clear());
    bestEffort(() => platform.playback.setRemoteStream(null));
  }
  function fail(session: Attempt, message: string) {
    if (!live(session)) return;
    cleanup(session, new RealtimeTransportError(message));
    listeners.forEach((listener) => listener.error(message));
  }
  function closed(session: Attempt) {
    if (!live(session)) return;
    cleanup(session, new RealtimeTransportError("Realtime connection closed."));
    listeners.forEach((listener) => listener.closed());
  }
  function transcript(
    session: Attempt,
    event: Record<string, unknown>,
    role: "user" | "assistant",
    completed: boolean,
  ) {
    if (typeof event.item_id !== "string") return;
    const previous = session.transcripts.get(event.item_id);
    if (previous?.completed && !completed) return;
    const fragment = completed ? event.transcript : event.delta;
    if (typeof fragment !== "string") return;
    const item = {
      id: event.item_id,
      role,
      text: (completed ? fragment : (previous?.text ?? "") + fragment).slice(-8_000),
      completed,
    };
    session.transcripts.set(item.id, item);
    if (session.transcripts.size > 100) {
      const oldest = session.transcripts.keys().next().value;
      if (oldest !== undefined) session.transcripts.delete(oldest);
    }
    listeners.forEach((listener) =>
      completed ? listener.completed(item) : listener.transcript(item),
    );
  }
  function message(session: Attempt, data: unknown) {
    if (!live(session)) return;
    try {
      const event = record(typeof data === "string" ? JSON.parse(data) : null);
      if (!event) throw new RealtimeTransportError("Invalid realtime event.");
      switch (event.type) {
        case "session.created": {
          const id = record(event.session)?.id;
          if (typeof id !== "string" || !id)
            throw new RealtimeTransportError("Realtime session has no ID.");
          session.created.resolve(id);
          break;
        }
        case "response.created":
          session.responseActive = true;
          break;
        case "response.done":
          session.responseActive = false;
          if (record(event.response)?.status === "failed")
            fail(session, "Realtime response failed.");
          else resumeAfterTools(session);
          break;
        case "response.function_call_arguments.done":
          void contextCall(session, event);
          break;
        case "response.output_audio_transcript.delta":
          transcript(session, event, "assistant", false);
          break;
        case "response.output_audio_transcript.done":
          transcript(session, event, "assistant", true);
          break;
        case "conversation.item.input_audio_transcription.delta":
          transcript(session, event, "user", false);
          break;
        case "conversation.item.input_audio_transcription.completed":
          transcript(session, event, "user", true);
          break;
        case "error":
          fail(session, "Realtime provider reported an error.");
          break;
      }
    } catch {
      fail(session, "Invalid realtime event.");
    }
  }
  function send(session: Attempt, type: string) {
    sendEvent(session, { type });
  }
  function sendEvent(session: Attempt, event: Record<string, unknown>) {
    if (!live(session) || session.channel?.readyState !== "open") {
      throw new RealtimeTransportError("Realtime event channel is not open.");
    }
    session.channel.send(JSON.stringify(event));
  }

  function resumeAfterTools(session: Attempt) {
    if (
      !live(session) ||
      !session.resumeRequested ||
      session.pendingTools ||
      session.responseActive
    )
      return;
    session.resumeRequested = false;
    send(session, "response.create");
    session.responseActive = true;
  }
  async function contextCall(session: Attempt, event: Record<string, unknown>) {
    const callId = event.call_id;
    if (typeof callId !== "string" || !callId) {
      fail(session, "Realtime context call has no ID.");
      return;
    }
    if (session.calls.has(callId)) return;
    session.calls.add(callId);
    const toolGeneration = session.toolGeneration;
    session.pendingTools += 1;
    let output: string;
    try {
      if (!session.portfolioAccess || !options.contextTools) throw new Error();
      if (typeof event.arguments !== "string") throw new Error();
      const args = record(JSON.parse(event.arguments));
      if (!args || Array.isArray(args)) throw new Error();
      let result: unknown;
      if (event.name === "portfolio_context_sources" && !Object.keys(args).length) {
        result = await wait(session, options.contextTools.sources());
      } else if (event.name === "portfolio_context_read") {
        result = await wait(session, options.contextTools.read(args));
      } else throw new Error();
      output = JSON.stringify(result ?? null);
    } catch {
      output = JSON.stringify({
        error:
          "Context access is unavailable, disabled or invalid. Only read-only context tools are supported.",
      });
    }
    if (toolGeneration === session.toolGeneration) session.pendingTools -= 1;
    if (!live(session)) return;
    try {
      sendEvent(session, {
        type: "conversation.item.create",
        item: { type: "function_call_output", call_id: callId, output },
      });
      if (toolGeneration === session.toolGeneration) {
        session.resumeRequested = true;
        resumeAfterTools(session);
      }
    } catch {
      fail(session, "Unable to return realtime context results.");
    }
  }

  return {
    async start(input) {
      if (current)
        throw new RealtimeTransportError("Realtime session is already starting or active.");
      const session = attempt();
      session.portfolioAccess = input.portfolioAccess ?? true;
      current = session;
      const request: StartInput = {
        projectId: input.projectId,
        threadId: input.threadId,
        ...(input.portfolioAccess === undefined ? {} : { portfolioAccess: input.portfolioAccess }),
        ...(input.documentBudgetBytes === undefined
          ? {}
          : { documentBudgetBytes: input.documentBudgetBytes }),
        ...(input.selectedMessageId === undefined
          ? {}
          : { selectedMessageId: input.selectedMessageId }),
        ...(input.documentPaths === undefined ? {} : { documentPaths: [...input.documentPaths] }),
      };
      session.timer = setTimeout(
        () => fail(session, "Realtime session startup timed out."),
        options.startTimeoutMs ?? 20_000,
      );
      try {
        const acquisition = platform.getUserMedia({ audio: true }).then((stream) => {
          if (!live(session)) stopTracks(stream);
          else session.local = stream;
          return stream;
        });
        const local = await wait(session, acquisition);
        ensureLive(session);
        const tracks = local.getAudioTracks();
        if (!tracks.length) throw new RealtimeTransportError("Microphone supplied no audio track.");
        tracks.forEach((track) => {
          track.enabled = !micMuted;
        });
        const secret = await wait(session, options.bootstrap(request));
        ensureLive(session);
        if (
          secret.context.projectId !== request.projectId ||
          secret.context.threadId !== request.threadId ||
          secret.context.selectedMessageId !== (request.selectedMessageId ?? null)
        ) {
          throw new RealtimeTransportError(
            "Realtime bootstrap context does not match the requested target.",
          );
        }
        if (!secret.clientSecret || secret.expiresAt <= Date.now() / 1000) {
          throw new RealtimeTransportError(
            "Realtime bootstrap returned an expired or missing client secret.",
          );
        }
        const peer = platform.createPeerConnection();
        session.peer = peer;
        peer.ontrack = (event) => {
          if (!live(session)) return;
          const stream = event.streams[0];
          if (!stream) {
            fail(session, "Realtime remote audio has no stream.");
            return;
          }
          try {
            if (stream !== session.remote) stopTracks(session.remote);
            session.remote = stream;
            stream.getAudioTracks().forEach((track) => {
              track.enabled = !assistantMuted;
            });
            platform.playback.setMuted(assistantMuted);
            platform.playback.setRemoteStream(stream);
          } catch {
            fail(session, "Unable to play realtime audio.");
          }
        };
        peer.onconnectionstatechange = () => {
          if (peer.connectionState === "failed") fail(session, "Realtime peer connection failed.");
          else if (peer.connectionState === "closed") closed(session);
        };
        tracks.forEach((track) => peer.addTrack(track, local));
        const channel = peer.createDataChannel("oai-events");
        session.channel = channel;
        channel.onmessage = (event) => message(session, event.data);
        channel.onerror = () => fail(session, "Realtime event channel failed.");
        channel.onclose = () => closed(session);
        const offer = await wait(session, peer.createOffer());
        ensureLive(session);
        if (!offer.sdp) throw new RealtimeTransportError("Realtime peer supplied no SDP offer.");
        await wait(session, peer.setLocalDescription({ type: "offer", sdp: offer.sdp }));
        ensureLive(session);
        const response = await wait(
          session,
          platform.fetch("https://api.openai.com/v1/realtime/calls", {
            method: "POST",
            body: offer.sdp,
            headers: {
              Authorization: `Bearer ${secret.clientSecret}`,
              "Content-Type": "application/sdp",
            },
            signal: session.abort.signal,
          }),
        );
        ensureLive(session);
        if (!response.ok)
          throw new RealtimeTransportError(`Realtime SDP exchange failed (${response.status}).`);
        const answer = await wait(session, response.text());
        ensureLive(session);
        if (!answer.trim()) throw new RealtimeTransportError("Realtime SDP answer is empty.");
        await wait(session, peer.setRemoteDescription({ type: "answer", sdp: answer }));
        ensureLive(session);
        const id = await wait(session, session.created.promise);
        if (!live(session)) throw new RealtimeTransportError("Realtime session stopped.");
        if (session.timer !== null) clearTimeout(session.timer);
        session.timer = null;
        return id;
      } catch (error) {
        const message =
          error instanceof RealtimeTransportError
            ? error.message
            : "Unable to start realtime voice.";
        if (live(session)) fail(session, message);
        throw new RealtimeTransportError(message);
      }
    },
    async stop() {
      if (current) cleanup(current, new RealtimeTransportError("Realtime session stopped."));
    },
    setMicMuted(muted) {
      micMuted = muted;
      try {
        current?.local?.getAudioTracks().forEach((track) => {
          track.enabled = !muted;
        });
      } catch {
        if (current) fail(current, "Unable to mute realtime microphone.");
        throw new RealtimeTransportError("Unable to mute realtime microphone.");
      }
    },
    setAssistantMuted(muted) {
      assistantMuted = muted;
      try {
        current?.remote?.getAudioTracks().forEach((track) => {
          track.enabled = !muted;
        });
        platform.playback.setMuted(muted);
      } catch {
        if (current) fail(current, "Unable to mute realtime playback.");
        throw new RealtimeTransportError("Unable to mute realtime playback.");
      }
    },
    interrupt() {
      const session = current;
      if (!session) return;
      session.toolGeneration += 1;
      session.pendingTools = 0;
      session.resumeRequested = false;
      try {
        // WebRTC output-buffer clearing also truncates unheard conversation audio.
        if (session.responseActive) send(session, "response.cancel");
        send(session, "output_audio_buffer.clear");
        session.responseActive = false;
        platform.playback.clear();
      } catch {
        fail(session, "Unable to interrupt realtime audio.");
        throw new RealtimeTransportError("Unable to interrupt realtime audio.");
      }
    },
    subscribe(handlers) {
      listeners.add(handlers);
      return () => {
        listeners.delete(handlers);
      };
    },
  };
}
