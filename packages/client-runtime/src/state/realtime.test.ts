import { describe, expect, it } from "@effect/vitest";
import { EventId, ProviderDriverKind, ThreadId } from "@t3tools/contracts";
import { createRealtimeState, reduceRealtimeEvent } from "./realtime.ts";

const threadId = ThreadId.make("thread-1");
const base = { eventId: EventId.make("evt-1"), threadId, createdAt: "2026-08-26T00:00:00.000Z", provider: ProviderDriverKind.make("codex") };

describe("realtime state", () => {
  it("projects the canonical lifecycle and audio events", () => {
    let state = createRealtimeState(threadId);
    state = reduceRealtimeEvent(state, { ...base, type: "thread.realtime.started", payload: { realtimeSessionId: "rt-1" } });
    state = reduceRealtimeEvent(state, { ...base, type: "thread.realtime.item-added", payload: { item: { role: "user" } } });
    state = reduceRealtimeEvent(state, { ...base, type: "thread.realtime.audio.delta", payload: { audio: { data: "AA==", numChannels: 1, sampleRate: 24000 } } });
    expect(state.status).toBe("active");
    expect(state.realtimeSessionId).toBe("rt-1");
    expect(state.items).toHaveLength(1);
    expect(state.audio).toHaveLength(1);
  });

  it("ignores events for another thread", () => {
    const state = createRealtimeState(threadId);
    const event = { ...base, threadId: ThreadId.make("other"), type: "thread.realtime.closed" as const, payload: {} };
    expect(reduceRealtimeEvent(state, event)).toBe(state);
  });
});
