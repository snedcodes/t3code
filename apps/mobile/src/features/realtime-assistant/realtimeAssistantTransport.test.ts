import { describe, expect, it, vi } from "vite-plus/test";
import { ProjectId, ThreadId, type RealtimeClientSecretResponse } from "@t3tools/contracts";
import {
  createOpenAiRealtimeTransport,
  type RealtimeVoicePlatform,
  type VoiceDataChannel,
  type VoicePeer,
  type RealtimeContextTools,
} from "./realtimeAssistantTransport";
import { RealtimeAssistantController, type RealtimeTransport } from "./realtimeAssistantController";
import { RealtimeConversationOutbox } from "./realtimeConversationOutbox";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
function fixture(
  timeout = 20_000,
  contextTools?: RealtimeContextTools,
  onCompleted?: Parameters<typeof createOpenAiRealtimeTransport>[0]["onCompleted"],
  messageTools?: Parameters<typeof createOpenAiRealtimeTransport>[0]["messageTools"],
) {
  const localTrack = { enabled: true, stop: vi.fn() };
  const remoteTrack = { enabled: true, stop: vi.fn() };
  const local = { getTracks: () => [localTrack], getAudioTracks: () => [localTrack] };
  const remote = { getTracks: () => [remoteTrack], getAudioTracks: () => [remoteTrack] };
  const channel = {
    readyState: "open",
    onmessage: null as VoiceDataChannel["onmessage"],
    onclose: null as VoiceDataChannel["onclose"],
    onerror: null as VoiceDataChannel["onerror"],
    send: vi.fn(),
    close: vi.fn(),
  } satisfies VoiceDataChannel;
  const remoteSet = deferred<void>();
  const peer = {
    connectionState: "new",
    ontrack: null as VoicePeer["ontrack"],
    onconnectionstatechange: null as VoicePeer["onconnectionstatechange"],
    addTrack: vi.fn(),
    createDataChannel: vi.fn(() => channel),
    createOffer: vi.fn(async () => ({ type: "offer" as const, sdp: "offer-sdp" })),
    setLocalDescription: vi.fn(async () => {}),
    setRemoteDescription: vi.fn(async () => {
      remoteSet.resolve();
    }),
    close: vi.fn(),
  } satisfies VoicePeer;
  const mediaRequested = deferred<void>();
  const bootstrapRequested = deferred<void>();
  const fetchRequested = deferred<void>();
  const response = { ok: true, status: 201, text: vi.fn(async () => "answer-sdp") };
  const secret = (
    input: Parameters<RealtimeTransport["start"]>[0],
  ): RealtimeClientSecretResponse => ({
    clientSecret: "ephemeral-test-token",
    expiresAt: Math.floor(Date.now() / 1000) + 60,
    model: "gpt-realtime-2.1",
    warnings: [],
    context: {
      projectId: ProjectId.make(input.projectId),
      threadId: ThreadId.make(input.threadId),
      threadUpdatedAt: "2026-10-01",
      messageIds: [],
      messageCount: 0,
      selectedMessageId: input.selectedMessageId ?? null,
      latestTurnId: null,
      truncated: false,
      documents: [],
      documentsTruncated: false,
      tasks: [],
      tasksLoaded: false,
      tasksTruncated: false,
      conversationThreadId: null,
      conversationMessageCount: 0,
      conversationTruncated: false,
    },
  });
  const bootstrap = vi.fn(async (input: Parameters<RealtimeTransport["start"]>[0]) => {
    bootstrapRequested.resolve();
    return secret(input);
  });
  const platform = {
    createPeerConnection: vi.fn(() => peer),
    getUserMedia: vi.fn(async () => {
      mediaRequested.resolve();
      return local;
    }),
    fetch: vi.fn(async (_url: string, _init: Parameters<RealtimeVoicePlatform["fetch"]>[1]) => {
      fetchRequested.resolve();
      return response;
    }),
    playback: { setRemoteStream: vi.fn(), setMuted: vi.fn(), clear: vi.fn() },
  } satisfies RealtimeVoicePlatform;
  const transport = createOpenAiRealtimeTransport({
    bootstrap,
    platform,
    startTimeoutMs: timeout,
    onCompleted,
    messageTools,
    ...(contextTools ? { contextTools } : {}),
  });
  const handlers = { transcript: vi.fn(), completed: vi.fn(), error: vi.fn(), closed: vi.fn() };
  transport.subscribe(handlers);
  const emit = (event: Record<string, unknown>) =>
    channel.onmessage?.({ data: JSON.stringify(event) });
  const input = { projectId: "project-1", threadId: "thread-1" };
  return {
    localTrack,
    remoteTrack,
    local,
    remote,
    channel,
    peer,
    remoteSet,
    platform,
    bootstrap,
    transport,
    handlers,
    emit,
    input,
    mediaRequested,
    bootstrapRequested,
    fetchRequested,
    secret,
    response,
  };
}

describe("Realtime WebRTC protocol transport", () => {
  it("dispatches attached-thread message tools with Portfolio Off and rejects target overrides", async () => {
    const tools = {
      draft: vi.fn(async (input: { text: string }) => ({
        draftId: "draft-1",
        text: input.text,
        status: "draft",
      })),
      get: vi.fn(async () => ({ draftId: "draft-1", status: "draft" })),
      send: vi.fn(async (_input: { draftId: string }) => ({ status: "queued" })),
    };
    const f = fixture(20_000, undefined, undefined, tools);
    const start = f.transport.start({ ...f.input, portfolioAccess: false });
    await f.remoteSet.promise;
    f.emit({ type: "session.created", session: { id: "session" } });
    await start;
    f.emit({ type: "response.created" });
    async function call(name: string, args: unknown, callId: string) {
      const output = deferred<void>();
      f.channel.send.mockImplementationOnce(() => output.resolve());
      f.emit({
        type: "response.function_call_arguments.done",
        name,
        call_id: callId,
        arguments: JSON.stringify(args),
      });
      await output.promise;
      return JSON.parse(f.channel.send.mock.calls.at(-1)![0]).item;
    }
    expect(
      JSON.parse(
        (await call("assistant_draft_message", { text: "Implement this" }, "draft")).output,
      ),
    ).toMatchObject({ status: "draft" });
    await call("assistant_get_draft", {}, "get");
    expect(tools.send).not.toHaveBeenCalled();
    await call("assistant_send_draft", { draftId: "draft-1", threadId: "other" }, "bad-target");
    expect(tools.send).not.toHaveBeenCalled();
    expect(
      JSON.parse((await call("assistant_send_draft", { draftId: "draft-1" }, "send")).output),
    ).toEqual({ status: "queued" });
    expect(tools.send).toHaveBeenCalledWith({ draftId: "draft-1" });
    f.emit({
      type: "response.function_call_arguments.done",
      name: "assistant_send_draft",
      call_id: "send",
      arguments: '{"draftId":"draft-1"}',
    });
    expect(tools.send).toHaveBeenCalledOnce();
    await f.transport.stop();
  });
  it("retains full completed utterances for canonical delivery through display eviction and failed sends", async () => {
    const save = vi.fn(
      async (
        input: Parameters<ConstructorParameters<typeof RealtimeConversationOutbox>[1]>[0],
      ) => ({ conversationThreadId: input.conversationThreadId, saved: input.items.length }),
    );
    save.mockRejectedValueOnce(new Error("private provider detail"));
    const queue = new RealtimeConversationOutbox(
      { projectId: "project-1", threadId: "thread-1", conversationThreadId: "voice-thread" },
      save,
    );
    const f = fixture(20_000, undefined, (item, sessionId) => queue.enqueue(item, sessionId));
    const start = f.transport.start(f.input);
    await f.remoteSet.promise;
    f.emit({ type: "session.created", session: { id: "session" } });
    await start;
    const fullText = "x".repeat(9000);
    f.emit({
      type: "response.output_audio_transcript.done",
      item_id: "first",
      transcript: fullText,
    });
    for (let index = 0; index < 101; index++)
      f.emit({
        type: "conversation.item.input_audio_transcription.completed",
        item_id: `user-${index}`,
        transcript: `message ${index}`,
      });
    await queue.flush();
    await f.transport.stop();
    expect(queue.snapshot()).toMatchObject({ pending: 102, error: expect.any(String) });
    expect(queue.snapshot().error).not.toContain("private");
    await queue.retry();
    expect(queue.snapshot()).toEqual({ pending: 0, saving: false, error: null });
    const sent = save.mock.calls.slice(1).flatMap(([input]) => input.items);
    expect(sent).toHaveLength(102);
    expect(sent[0]).toEqual({ id: "first", role: "assistant", text: fullText });
    expect(
      save.mock.calls.every(
        ([input]) =>
          input.items.length <= 50 &&
          input.sessionId === "session" &&
          input.conversationThreadId === "voice-thread",
      ),
    ).toBe(true);
  });
  it("keeps an interrupted pending read in history without resuming speech, while allowing new calls", async () => {
    const result = deferred<unknown>();
    const called = deferred<void>();
    const tools = {
      sources: vi.fn(async () => ({ sources: [] })),
      read: vi.fn(() => {
        called.resolve();
        return result.promise;
      }),
    };
    const f = fixture(20_000, tools);
    const start = f.transport.start(f.input);
    await f.remoteSet.promise;
    f.emit({ type: "session.created", session: { id: "session" } });
    await start;
    f.emit({ type: "response.created" });
    f.emit({
      type: "response.function_call_arguments.done",
      name: "portfolio_context_read",
      call_id: "interrupted",
      arguments: '{"operation":"read_portfolio"}',
    });
    await called.promise;
    f.transport.interrupt();
    f.channel.send.mockClear();
    const output = deferred<void>();
    f.channel.send.mockImplementationOnce(() => output.resolve());
    result.resolve({ data: "history-only" });
    await output.promise;
    f.emit({ type: "response.done", response: { status: "cancelled" } });
    expect(f.channel.send).toHaveBeenCalledOnce();
    expect(JSON.parse(f.channel.send.mock.calls[0]![0]).item.type).toBe("function_call_output");
    const next = deferred<void>();
    f.channel.send.mockImplementationOnce(() => next.resolve());
    f.emit({
      type: "response.function_call_arguments.done",
      name: "portfolio_context_sources",
      call_id: "next-call",
      arguments: "{}",
    });
    await next.promise;
    expect(JSON.parse(f.channel.send.mock.calls[2]![0])).toEqual({ type: "response.create" });
    await f.transport.stop();
  });
  it("returns discovered sources and exact paged context, deduplicating calls and waiting for response completion", async () => {
    const tools = {
      sources: vi.fn(async () => ({ sources: [{ environmentId: "other-env" }] })),
      read: vi.fn(async () => ({
        environmentId: "other-env",
        data: "plan",
        nextOffset: 123,
        truncated: true,
      })),
    };
    const f = fixture(20_000, tools);
    const start = f.transport.start({ ...f.input, portfolioAccess: true });
    await f.remoteSet.promise;
    f.emit({ type: "session.created", session: { id: "session" } });
    await start;
    expect(f.bootstrap).toHaveBeenCalledWith({ ...f.input, portfolioAccess: true });
    const output = deferred<void>();
    f.channel.send.mockImplementationOnce(() => output.resolve());
    f.emit({ type: "response.created" });
    const call = {
      type: "response.function_call_arguments.done",
      name: "portfolio_context_sources",
      call_id: "sources-1",
      arguments: "{}",
    };
    f.emit(call);
    f.emit(call);
    await output.promise;
    expect(tools.sources).toHaveBeenCalledOnce();
    expect(JSON.parse(f.channel.send.mock.calls[0]![0])).toEqual({
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: "sources-1",
        output: JSON.stringify(await tools.sources.mock.results[0]!.value),
      },
    });
    expect(f.channel.send).toHaveBeenCalledOnce();
    f.emit({ type: "response.done", response: { status: "completed" } });
    expect(JSON.parse(f.channel.send.mock.calls[1]![0])).toEqual({ type: "response.create" });
    const readOutput = deferred<void>();
    f.channel.send.mockImplementationOnce(() => readOutput.resolve());
    const request = {
      environmentId: "other-env",
      operation: "read_file",
      projectId: "other-project",
      path: "docs/plan.md",
      offset: 123,
    };
    f.emit({
      type: "response.function_call_arguments.done",
      name: "portfolio_context_read",
      call_id: "read-1",
      arguments: JSON.stringify(request),
    });
    await readOutput.promise;
    expect(tools.read).toHaveBeenCalledWith(request);
    expect(JSON.parse(JSON.parse(f.channel.send.mock.calls[2]![0]).item.output)).toMatchObject({
      nextOffset: 123,
      truncated: true,
    });
    await f.transport.stop();
  });

  it("rejects disabled tools without executing them and sanitizes unsupported/failed calls", async () => {
    const tools = {
      sources: vi.fn(async () => ({})),
      read: vi.fn(async () => {
        throw new Error("secret-platform-detail");
      }),
    };
    const f = fixture(20_000, tools);
    const start = f.transport.start({ ...f.input, portfolioAccess: false });
    await f.remoteSet.promise;
    f.emit({ type: "session.created", session: { id: "session" } });
    await start;
    f.emit({
      type: "response.function_call_arguments.done",
      name: "portfolio_context_sources",
      call_id: "disabled",
      arguments: "{}",
    });
    expect(tools.sources).not.toHaveBeenCalled();
    expect(f.channel.send.mock.calls[0]![0]).toContain("disabled");
    await f.transport.stop();
    const ready = deferred<void>();
    f.peer.setRemoteDescription.mockImplementationOnce(async () => ready.resolve());
    const restarted = f.transport.start(f.input);
    await ready.promise;
    f.emit({ type: "session.created", session: { id: "next-session" } });
    await restarted;
    f.emit({
      type: "response.function_call_arguments.done",
      name: "mutate_task",
      call_id: "unsupported",
      arguments: "{}",
    });
    expect(tools.read).not.toHaveBeenCalled();
    const output = deferred<void>();
    f.channel.send.mockImplementationOnce(() => output.resolve());
    f.emit({
      type: "response.function_call_arguments.done",
      name: "portfolio_context_read",
      call_id: "failed",
      arguments: '{"operation":"read_portfolio"}',
    });
    await output.promise;
    expect(f.channel.send.mock.calls.map(([data]) => data).join("\n")).not.toContain(
      "secret-platform-detail",
    );
    await f.transport.stop();
  });

  it("never returns late context results after stopping a session", async () => {
    const result = deferred<unknown>();
    const called = deferred<void>();
    const tools = {
      sources: vi.fn(async () => ({})),
      read: vi.fn(() => {
        called.resolve();
        return result.promise;
      }),
    };
    const f = fixture(20_000, tools);
    const start = f.transport.start(f.input);
    await f.remoteSet.promise;
    f.emit({ type: "session.created", session: { id: "session" } });
    await start;
    f.emit({
      type: "response.function_call_arguments.done",
      name: "portfolio_context_read",
      call_id: "late",
      arguments: '{"operation":"read_portfolio"}',
    });
    await called.promise;
    await f.transport.stop();
    result.resolve({ data: "late-private-content" });
    await result.promise;
    expect(f.channel.send).not.toHaveBeenCalled();
  });
  it("negotiates an ephemeral SDP session, transcribes, mutes real tracks, interrupts and releases", async () => {
    const f = fixture();
    const documentPaths = ["README.md"];
    const input = {
      ...f.input,
      selectedMessageId: "message-1",
      documentPaths,
      documentBudgetBytes: 524288,
    };
    f.transport.setMicMuted(true);
    const start = f.transport.start(input);
    documentPaths.push("mutated-after-start.md");
    await f.remoteSet.promise;
    expect(f.bootstrap).toHaveBeenCalledWith({
      ...f.input,
      selectedMessageId: "message-1",
      documentPaths: ["README.md"],
      documentBudgetBytes: 524288,
    });
    expect(f.platform.getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(f.peer.addTrack).toHaveBeenCalledWith(f.localTrack, f.local);
    expect(f.localTrack.enabled).toBe(false);
    expect(f.peer.createDataChannel).toHaveBeenCalledWith("oai-events");
    expect(f.platform.fetch).toHaveBeenCalledWith(
      "https://api.openai.com/v1/realtime/calls",
      expect.objectContaining({
        method: "POST",
        body: "offer-sdp",
        headers: {
          Authorization: "Bearer ephemeral-test-token",
          "Content-Type": "application/sdp",
        },
        signal: expect.any(AbortSignal),
      }),
    );
    expect(f.peer.setRemoteDescription).toHaveBeenCalledWith({ type: "answer", sdp: "answer-sdp" });
    let started = false;
    void start.then(() => {
      started = true;
    });
    f.emit({ type: "session.updated", session: { id: "not-created" } });
    await Promise.resolve();
    expect(started).toBe(false);
    f.emit({ type: "session.created", session: { id: "actual-session" } });
    expect(await start).toBe("actual-session");
    f.transport.setMicMuted(false);
    expect(f.localTrack.enabled).toBe(true);
    f.peer.ontrack?.({ streams: [f.remote] });
    expect(f.platform.playback.setRemoteStream).toHaveBeenCalledWith(f.remote);
    f.transport.setAssistantMuted(true);
    expect(f.remoteTrack.enabled).toBe(false);
    expect(f.platform.playback.setMuted).toHaveBeenLastCalledWith(true);
    f.transport.setAssistantMuted(false);
    expect(f.remoteTrack.enabled).toBe(true);
    f.emit({
      type: "response.output_audio_transcript.delta",
      item_id: "assistant-1",
      delta: "Hel",
    });
    f.emit({ type: "response.output_audio_transcript.delta", item_id: "assistant-1", delta: "lo" });
    expect(f.handlers.transcript).toHaveBeenLastCalledWith({
      id: "assistant-1",
      role: "assistant",
      text: "Hello",
      completed: false,
    });
    f.emit({
      type: "response.output_audio_transcript.done",
      item_id: "assistant-1",
      transcript: "Hello!",
    });
    f.emit({
      type: "conversation.item.input_audio_transcription.completed",
      item_id: "user-1",
      transcript: "Tell me more",
    });
    expect(f.handlers.completed).toHaveBeenLastCalledWith({
      id: "user-1",
      role: "user",
      text: "Tell me more",
      completed: true,
    });
    f.emit({ type: "response.created" });
    f.transport.interrupt();
    expect(f.channel.send.mock.calls.map(([data]) => JSON.parse(data))).toEqual([
      { type: "response.cancel" },
      { type: "output_audio_buffer.clear" },
    ]);
    expect(f.platform.playback.clear).toHaveBeenCalledOnce();
    const staleMessage = f.channel.onmessage!;
    await f.transport.stop();
    expect(f.localTrack.stop).toHaveBeenCalledOnce();
    expect(f.remoteTrack.stop).toHaveBeenCalledOnce();
    expect(f.peer.close).toHaveBeenCalledOnce();
    expect(f.channel.close).toHaveBeenCalledOnce();
    expect(f.channel.onmessage).toBeNull();
    expect(f.peer.ontrack).toBeNull();
    expect(f.platform.playback.setRemoteStream).toHaveBeenLastCalledWith(null);
    staleMessage({ data: JSON.stringify({ type: "error" }) });
    expect(f.handlers.error).not.toHaveBeenCalled();
  });

  it.each(["permissions", "bootstrap", "fetch", "session-created"] as const)(
    "cancels pending %s without waiting or reopening",
    async (stage) => {
      const f = fixture();
      const permission = deferred<typeof f.local>();
      const bootstrap = deferred<RealtimeClientSecretResponse>();
      const fetch = deferred<typeof f.response>();
      if (stage === "permissions")
        f.platform.getUserMedia.mockImplementationOnce(() => {
          f.mediaRequested.resolve();
          return permission.promise;
        });
      if (stage === "bootstrap")
        f.bootstrap.mockImplementationOnce(() => {
          f.bootstrapRequested.resolve();
          return bootstrap.promise;
        });
      if (stage === "fetch")
        f.platform.fetch.mockImplementationOnce(() => {
          f.fetchRequested.resolve();
          return fetch.promise;
        });
      const start = f.transport.start(f.input);
      const rejected = expect(start).rejects.toThrow("stopped");
      await (stage === "permissions"
        ? f.mediaRequested.promise
        : stage === "bootstrap"
          ? f.bootstrapRequested.promise
          : stage === "fetch"
            ? f.fetchRequested.promise
            : f.remoteSet.promise);
      await f.transport.stop();
      await rejected;
      if (stage === "permissions") permission.resolve(f.local);
      if (stage === "bootstrap") bootstrap.resolve(f.secret(f.input));
      if (stage === "fetch") fetch.resolve(f.response);
      f.emit({ type: "session.created", session: { id: "stale" } });
      await Promise.resolve();
      expect(f.localTrack.stop).toHaveBeenCalledOnce();
      expect(f.handlers.error).not.toHaveBeenCalled();
      if (stage === "permissions" || stage === "bootstrap")
        expect(f.platform.createPeerConnection).not.toHaveBeenCalled();
      if (stage === "fetch") {
        expect(f.platform.fetch.mock.calls[0]![1].signal.aborted).toBe(true);
        expect(f.peer.setRemoteDescription).not.toHaveBeenCalled();
      }
    },
  );

  it.each(["permissions", "bootstrap", "sdp", "context", "expired"] as const)(
    "cleans up %s startup failure",
    async (stage) => {
      const f = fixture();
      if (stage === "permissions")
        f.platform.getUserMedia.mockRejectedValueOnce(new Error("permission denied"));
      if (stage === "bootstrap") f.bootstrap.mockRejectedValueOnce(new Error("bootstrap denied"));
      if (stage === "sdp")
        f.platform.fetch.mockResolvedValueOnce({ ...f.response, ok: false, status: 401 });
      if (stage === "context")
        f.bootstrap.mockResolvedValueOnce({
          ...f.secret(f.input),
          context: { ...f.secret(f.input).context, threadId: ThreadId.make("wrong-thread") },
        });
      if (stage === "expired")
        f.bootstrap.mockResolvedValueOnce({ ...f.secret(f.input), expiresAt: 1 });
      await expect(f.transport.start(f.input)).rejects.toThrow();
      expect(f.handlers.error).toHaveBeenCalledOnce();
      expect(f.platform.playback.setRemoteStream).toHaveBeenLastCalledWith(null);
      if (stage !== "permissions") expect(f.localTrack.stop).toHaveBeenCalledOnce();
      if (stage === "sdp") expect(f.peer.close).toHaveBeenCalledOnce();
      else expect(f.platform.fetch).not.toHaveBeenCalled();
    },
  );

  it("ignores detached old callbacks after a replacement session opens", async () => {
    const f = fixture();
    const first = f.transport.start(f.input);
    await f.remoteSet.promise;
    f.emit({ type: "session.created", session: { id: "first" } });
    await first;
    const oldMessage = f.channel.onmessage!;
    const oldTrack = f.peer.ontrack!;
    await f.transport.stop();
    const negotiated = deferred<void>();
    f.peer.setRemoteDescription.mockImplementationOnce(async () => {
      negotiated.resolve();
    });
    const replacement = f.transport.start(f.input);
    await negotiated.promise;
    oldMessage({ data: JSON.stringify({ type: "session.created", session: { id: "old" } }) });
    oldMessage({ data: JSON.stringify({ type: "error" }) });
    oldTrack({ streams: [f.remote] });
    expect(f.platform.playback.setRemoteStream).not.toHaveBeenCalledWith(f.remote);
    expect(f.handlers.error).not.toHaveBeenCalled();
    f.emit({ type: "session.created", session: { id: "replacement" } });
    expect(await replacement).toBe("replacement");
    await f.transport.stop();
  });

  it("reuses a muted session with fresh false mutes before microphone acquisition", async () => {
    const f = fixture();
    const controller = new RealtimeAssistantController(f.input, f.transport);
    const first = controller.start();
    await f.remoteSet.promise;
    f.emit({ type: "session.created", session: { id: "first" } });
    await first;
    f.peer.ontrack?.({ streams: [f.remote] });
    controller.setMicMuted(true);
    controller.setAssistantMuted(true);
    expect(f.localTrack.enabled).toBe(false);
    expect(f.remoteTrack.enabled).toBe(false);
    await controller.stop();
    const freshTrack = { enabled: false, stop: vi.fn() };
    const freshStream = { getTracks: () => [freshTrack], getAudioTracks: () => [freshTrack] };
    f.platform.getUserMedia.mockImplementationOnce(async () => {
      expect(controller.getState()).toMatchObject({ micMuted: false, assistantMuted: false });
      expect(f.platform.playback.setMuted).toHaveBeenLastCalledWith(false);
      return freshStream;
    });
    const negotiated = deferred<void>();
    f.peer.setRemoteDescription.mockImplementationOnce(async () => {
      negotiated.resolve();
    });
    const next = controller.start();
    await negotiated.promise;
    f.emit({ type: "session.created", session: { id: "next" } });
    await next;
    expect(freshTrack.enabled).toBe(true);
    const freshRemoteTrack = { enabled: false, stop: vi.fn() };
    f.peer.ontrack?.({
      streams: [{ getTracks: () => [freshRemoteTrack], getAudioTracks: () => [freshRemoteTrack] }],
    });
    expect(freshRemoteTrack.enabled).toBe(true);
    await controller.dispose();
  });

  it("sanitizes platform/bootstrap errors before publishing or rejecting startup", async () => {
    const f = fixture();
    f.bootstrap.mockRejectedValueOnce(
      new Error("credential=private-token provider-private-response"),
    );
    await expect(f.transport.start(f.input)).rejects.toThrow("Unable to start realtime voice.");
    expect(f.handlers.error).toHaveBeenCalledWith("Unable to start realtime voice.");
    expect(JSON.stringify(f.handlers.error.mock.calls)).not.toContain("private-token");
  });

  it("sanitizes playback errors during controller startup", async () => {
    const f = fixture();
    f.platform.playback.setMuted.mockImplementationOnce(() => {
      throw new Error("secret-in-native-error");
    });
    const controller = new RealtimeAssistantController(f.input, f.transport);
    await controller.start();
    expect(controller.getState()).toMatchObject({
      status: "error",
      error: "Unable to mute realtime playback.",
    });
    expect(f.platform.getUserMedia).not.toHaveBeenCalled();
  });

  it("times out missing session.created and releases microphone/peer", async () => {
    const f = fixture(20);
    await expect(f.transport.start(f.input)).rejects.toThrow("timed out");
    expect(f.localTrack.stop).toHaveBeenCalledOnce();
    expect(f.peer.close).toHaveBeenCalledOnce();
    expect(f.handlers.error).toHaveBeenCalledWith("Realtime session startup timed out.");
  });

  it.each(["error", "closed", "peer-failed"] as const)(
    "releases an active session on %s",
    async (event) => {
      const f = fixture();
      const start = f.transport.start(f.input);
      await f.remoteSet.promise;
      f.emit({ type: "session.created", session: { id: "session-1" } });
      await start;
      if (event === "error")
        f.emit({ type: "error", error: { message: "upstream-private-detail" } });
      if (event === "closed") f.channel.onclose?.();
      if (event === "peer-failed") {
        f.peer.connectionState = "failed";
        f.peer.onconnectionstatechange?.();
      }
      expect(f.localTrack.stop).toHaveBeenCalledOnce();
      expect(f.peer.close).toHaveBeenCalledOnce();
      expect(f.channel.onmessage).toBeNull();
      if (event === "closed") expect(f.handlers.closed).toHaveBeenCalledOnce();
      else expect(f.handlers.error).toHaveBeenCalledOnce();
    },
  );
});
