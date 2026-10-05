import { describe, expect, it, vi } from "vite-plus/test";
import {
  RealtimeAssistantController,
  type RealtimeTransport,
  type RealtimeRecoveryOptions,
} from "./realtimeAssistantController";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function fixture(recovery: RealtimeRecoveryOptions = {}) {
  const started = deferred<void>();
  const stopped = deferred<void>();
  const subscriptions: Parameters<RealtimeTransport["subscribe"]>[0][] = [];
  const unsubscribers: ReturnType<typeof vi.fn>[] = [];
  const transport = {
    start: vi.fn(async () => {
      started.resolve();
      return "session-1";
    }),
    stop: vi.fn(async () => {
      stopped.resolve();
    }),
    setMicMuted: vi.fn(),
    setAssistantMuted: vi.fn(),
    interrupt: vi.fn(),
    subscribe: vi.fn((handlers: Parameters<RealtimeTransport["subscribe"]>[0]) => {
      subscriptions.push(handlers);
      const unsubscribe = vi.fn();
      unsubscribers.push(unsubscribe);
      return unsubscribe;
    }),
  } satisfies RealtimeTransport;
  const target = { projectId: "project-1", threadId: "thread-1" };
  const controller = new RealtimeAssistantController(target, transport, recovery);
  return { controller, target, transport, subscriptions, unsubscribers, started, stopped };
}

describe("RealtimeAssistantController", () => {
  it("recovers a dropped call with preserved intent and fences User End during backoff/readiness", async () => {
    vi.useFakeTimers();
    const beforeReconnect = vi.fn(async (_signal: AbortSignal) => {});
    const onCallIntentChanged = vi.fn();
    const f = fixture({ beforeReconnect, onCallIntentChanged });
    try {
      const paths = ["docs/status.md"];
      await f.controller.start({
        documentPaths: paths,
        selectedMessageId: "selected",
        portfolioAccess: false,
      });
      paths.push("mutated.md");
      f.controller.setMicMuted(true);
      f.controller.setAssistantMuted(true);
      const old = f.subscriptions[0]!;
      old.completed({ id: "saved", role: "user", text: "Already completed" });
      f.transport.start.mockResolvedValueOnce("recovered-session");
      old.error("Connection lost", "peer-failed");
      expect(f.controller.getState()).toMatchObject({ status: "reconnecting", sessionId: null });
      expect(f.controller.isCallRequested()).toBe(true);
      await vi.advanceTimersByTimeAsync(1_000);
      expect(f.controller.getState()).toMatchObject({
        status: "active",
        sessionId: "recovered-session",
        micMuted: true,
        assistantMuted: true,
        transcript: [{ id: "saved", role: "user", text: "Already completed", completed: true }],
      });
      expect(f.transport.start).toHaveBeenLastCalledWith({
        projectId: "project-1",
        threadId: "thread-1",
        documentPaths: ["docs/status.md"],
        selectedMessageId: "selected",
        portfolioAccess: false,
      });
      expect(f.transport.setMicMuted).toHaveBeenLastCalledWith(true);
      expect(f.transport.setAssistantMuted).toHaveBeenLastCalledWith(true);
      expect(onCallIntentChanged.mock.calls).toEqual([[true]]);
      old.closed("connection-closed");
      expect(f.controller.getState().status).toBe("active");
      // Keep retrying past three losses, with a per-call capped delay and no parallel start.
      for (const delay of [2_000, 4_000, 8_000, 16_000, 30_000, 30_000]) {
        f.subscriptions.at(-1)!.error("Network unavailable", "network-failed");
        const starts = f.transport.start.mock.calls.length;
        await vi.advanceTimersByTimeAsync(delay - 1);
        expect(f.transport.start).toHaveBeenCalledTimes(starts);
        await vi.advanceTimersByTimeAsync(1);
        expect(f.transport.start).toHaveBeenCalledTimes(starts + 1);
        expect(f.controller.getState().status).toBe("active");
      }
      // A network failure inside a reconnect start must drain before the next attempt.
      f.transport.start.mockImplementationOnce(async () => {
        f.subscriptions.at(-1)!.error("SDP network request failed", "network-failed");
        throw new Error("SDP network request failed");
      });
      f.subscriptions.at(-1)!.closed("connection-closed");
      await vi.advanceTimersByTimeAsync(30_000);
      expect(f.controller.getState().status).toBe("reconnecting");
      expect(f.controller.isCallRequested()).toBe(true);
      await vi.advanceTimersByTimeAsync(30_000);
      expect(f.controller.getState().status).toBe("active");
      f.subscriptions.at(-1)!.closed("connection-closed");
      const starts = f.transport.start.mock.calls.length;
      await f.controller.stop();
      await vi.advanceTimersByTimeAsync(90_000);
      expect(f.transport.start).toHaveBeenCalledTimes(starts);
      expect(f.controller.isCallRequested()).toBe(false);
      expect(f.controller.getState().status).toBe("stopped");

      // A fresh user Start resets mutes; cancelled native readiness must not acquire a mic.
      await f.controller.start();
      expect(f.controller.getState()).toMatchObject({ micMuted: false, assistantMuted: false });
      const ready = deferred<void>();
      let gateSignal: AbortSignal | undefined;
      beforeReconnect.mockImplementationOnce((signal) => {
        gateSignal = signal;
        return ready.promise;
      });
      f.subscriptions.at(-1)!.error("Channel failed", "channel-failed");
      await vi.advanceTimersByTimeAsync(1_000);
      expect(gateSignal?.aborted).toBe(false);
      const gatedStarts = f.transport.start.mock.calls.length;
      await f.controller.stop();
      expect(gateSignal?.aborted).toBe(true);
      ready.resolve();
      await vi.advanceTimersByTimeAsync(90_000);
      expect(f.transport.start).toHaveBeenCalledTimes(gatedStarts);
      expect(f.controller.getState().status).toBe("stopped");

      await f.controller.start();
      f.subscriptions.at(-1)!.error("Authentication required", "startup-failed");
      await vi.advanceTimersByTimeAsync(90_000);
      expect(f.controller.getState()).toMatchObject({
        status: "error",
        error: "Authentication required",
      });
      expect(f.controller.isCallRequested()).toBe(false);
      expect(f.transport.start).toHaveBeenCalledTimes(gatedStarts + 1);
      expect(onCallIntentChanged.mock.calls).toEqual([
        [true],
        [false],
        [true],
        [false],
        [true],
        [false],
      ]);
    } finally {
      await f.controller.dispose();
      vi.useRealTimers();
    }
  });

  it("keeps its target immutable and resets mutes on each fresh start", async () => {
    const f = fixture();
    expect(f.controller.getState().status).toBe("idle");
    f.target.projectId = "different-project";
    f.target.threadId = "different-thread";
    f.controller.setMicMuted(true);
    f.controller.setAssistantMuted(true);
    const input = { selectedMessageId: "message-1", projectId: "override", threadId: "override" };
    await f.controller.start(input);
    expect(f.transport.start).toHaveBeenCalledWith({
      projectId: "project-1",
      threadId: "thread-1",
      selectedMessageId: "message-1",
    });
    expect(f.controller.getState()).toMatchObject({
      status: "active",
      sessionId: "session-1",
      micMuted: false,
      assistantMuted: false,
    });
    await f.controller.start();
    expect(f.transport.start).toHaveBeenCalledOnce();
    f.controller.setMicMuted(true);
    f.controller.setAssistantMuted(true);
    expect(f.transport.setMicMuted).toHaveBeenLastCalledWith(true);
    expect(f.transport.setAssistantMuted).toHaveBeenLastCalledWith(true);
    f.controller.setMicMuted(false);
    f.controller.setAssistantMuted(false);
    expect(f.transport.setMicMuted).toHaveBeenLastCalledWith(false);
    expect(f.transport.setAssistantMuted).toHaveBeenLastCalledWith(false);
    f.controller.interrupt();
    expect(f.transport.interrupt).toHaveBeenCalledOnce();
    expect(f.controller.getState().status).toBe("active");
    await f.controller.stop();
    expect(f.controller.getState()).toMatchObject({ status: "stopped", sessionId: null });
    expect(f.unsubscribers[0]).toHaveBeenCalledOnce();
    await f.controller.start();
    expect(f.controller.getState()).toMatchObject({ micMuted: false, assistantMuted: false });
  });

  it("copies selected document paths before asynchronous startup", async () => {
    const f = fixture();
    const documentPaths = ["README.md"];
    const start = f.controller.start({
      selectedMessageId: "message-1",
      documentPaths,
      portfolioAccess: false,
      documentBudgetBytes: 524288,
    });
    documentPaths.push("changed.md");
    await start;
    expect(f.transport.start).toHaveBeenCalledWith({
      projectId: "project-1",
      threadId: "thread-1",
      selectedMessageId: "message-1",
      documentPaths: ["README.md"],
      portfolioAccess: false,
      documentBudgetBytes: 524288,
    });
  });

  it("applies mute changes during negotiation to the active session", async () => {
    const f = fixture();
    const opening = deferred<string>();
    f.transport.start.mockImplementationOnce(() => {
      f.started.resolve();
      return opening.promise;
    });
    const start = f.controller.start();
    await f.started.promise;
    expect(f.controller.getState().status).toBe("starting");
    f.controller.setMicMuted(true);
    f.controller.setAssistantMuted(true);
    opening.resolve("negotiated-session");
    await start;
    expect(f.controller.getState()).toMatchObject({
      status: "active",
      micMuted: true,
      assistantMuted: true,
    });
    expect(f.transport.setMicMuted).toHaveBeenLastCalledWith(true);
    expect(f.transport.setAssistantMuted).toHaveBeenLastCalledWith(true);
  });

  it("updates and completes bounded transcript snapshots without ending the session", async () => {
    const f = fixture();
    await f.controller.start();
    const events = f.subscriptions[0]!;
    events.transcript({ id: "one", role: "user", text: "hel" });
    events.transcript({ id: "one", role: "user", text: "hello" });
    events.completed({ id: "one", role: "user", text: "hello!" });
    events.transcript({ id: "one", role: "user", text: "late partial" });
    expect(f.controller.getState().transcript).toEqual([
      { id: "one", role: "user", text: "hello!", completed: true },
    ]);
    for (let index = 0; index < 101; ++index) {
      events.transcript({ id: String(index), role: "assistant", text: "x".repeat(9_000) });
    }
    expect(f.controller.getState().transcript).toHaveLength(100);
    expect(f.controller.getState().transcript[0]?.id).toBe("1");
    expect(f.controller.getState().transcript.every((item) => item.text.length === 8_000)).toBe(
      true,
    );
    expect(f.controller.getState().status).toBe("active");
    await f.controller.stop();
    expect(f.controller.getState().transcript).toHaveLength(100);
    await f.controller.start();
    expect(f.controller.getState().transcript).toEqual([]);
  });

  it("closes a late start and rejects stale callbacks before a replacement opens", async () => {
    const f = fixture();
    const opening = deferred<string>();
    const replacementStarted = deferred<void>();
    f.transport.start.mockImplementationOnce(() => {
      f.started.resolve();
      return opening.promise;
    });
    const first = f.controller.start();
    await f.started.promise;
    const stale = f.subscriptions[0]!;
    await f.controller.stop();
    const replacement = f.controller.start();
    f.transport.start.mockImplementationOnce(async () => {
      replacementStarted.resolve();
      return "session-2";
    });
    expect(f.transport.start).toHaveBeenCalledOnce();
    stale.transcript({ id: "old", role: "assistant", text: "old session" });
    stale.error("old error");
    stale.closed();
    opening.resolve("late-session-1");
    await first;
    await replacementStarted.promise;
    await replacement;
    expect(f.transport.stop).toHaveBeenCalledTimes(2);
    expect(f.controller.getState()).toMatchObject({
      status: "active",
      sessionId: "session-2",
      transcript: [],
      error: null,
    });
    stale.closed();
    expect(f.controller.getState().status).toBe("active");
  });

  it("dispose closes audio, ignores late start/events, and prevents restart", async () => {
    const f = fixture();
    const opening = deferred<string>();
    f.transport.start.mockImplementationOnce(() => {
      f.started.resolve();
      return opening.promise;
    });
    const listener = vi.fn();
    f.controller.subscribe(listener);
    const start = f.controller.start();
    await f.started.promise;
    await f.controller.dispose();
    const notifications = listener.mock.calls.length;
    opening.resolve("late-session");
    await start;
    f.subscriptions[0]!.transcript({ id: "late", role: "user", text: "ignored" });
    f.subscriptions[0]!.closed();
    await f.controller.start();
    expect(f.controller.getState()).toMatchObject({
      status: "stopped",
      sessionId: null,
      transcript: [],
    });
    expect(f.transport.stop).toHaveBeenCalledTimes(2);
    expect(f.transport.start).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledTimes(notifications);
    expect(f.unsubscribers[0]).toHaveBeenCalledOnce();
  });

  it.each(["error", "closed"] as const)(
    "closes transport/audio on a terminal %s event",
    async (event) => {
      const f = fixture();
      await f.controller.start();
      if (event === "error") f.subscriptions[0]!.error("provider failed");
      else f.subscriptions[0]!.closed();
      await f.stopped.promise;
      expect(f.controller.getState()).toMatchObject({
        status: event === "error" ? "error" : "stopped",
        sessionId: null,
        error: event === "error" ? "provider failed" : null,
      });
      expect(f.transport.stop).toHaveBeenCalledOnce();
      expect(f.unsubscribers[0]).toHaveBeenCalledOnce();
    },
  );

  it("closes transport on startup/control failure and reports a stop failure", async () => {
    const f = fixture();
    f.transport.start.mockRejectedValueOnce(new Error("bootstrap failed"));
    await f.controller.start();
    expect(f.controller.getState()).toMatchObject({
      status: "error",
      sessionId: null,
      error: "bootstrap failed",
    });
    expect(f.transport.stop).toHaveBeenCalledOnce();
    await f.controller.start();
    f.transport.interrupt.mockImplementationOnce(() => {
      throw new Error("interrupt failed");
    });
    f.controller.interrupt();
    expect(f.controller.getState()).toMatchObject({
      status: "error",
      sessionId: null,
      error: "interrupt failed",
    });
    await f.controller.start();
    f.transport.stop.mockRejectedValueOnce(new Error("audio teardown failed"));
    await f.controller.stop();
    expect(f.controller.getState()).toMatchObject({
      status: "error",
      sessionId: null,
      error: "audio teardown failed",
    });
  });
});
