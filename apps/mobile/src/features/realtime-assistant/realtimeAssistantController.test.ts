import { ThreadId } from "@t3tools/contracts";
import {
  RealtimeAssistantController,
  type PcmFrame,
  type PcmPlayer,
  type RealtimeTransport,
} from "./realtimeAssistantController";
import type { RealtimeState as ClientRealtimeState } from "@t3tools/client-runtime/state/realtime";

declare const describe: (name: string, run: () => void) => void;
declare const it: (name: string, run: () => Promise<void>) => void;
declare const expect: any;

function fixture() {
  const h = {
    started: [] as ((id: string) => void)[],
    audio: [] as ((audio: any) => void)[],
    closed: [] as (() => void)[],
  };
  const sent: PcmFrame[] = [];
  const played: any[] = [];
  let stops = 0;
  const player: PcmPlayer = { play: (audio) => played.push(audio), stop: () => stops++ };
  const transport: RealtimeTransport = {
    start: async () => h.started.forEach((fn) => fn("session-1")),
    appendAudio: async (frame) => {
      sent.push(frame);
    },
    stop: async () => h.closed.forEach((fn) => fn()),
    onStarted: (fn) => (h.started.push(fn), () => undefined),
    onItemAdded: () => () => undefined,
    onAudio: (fn) => (h.audio.push(fn), () => undefined),
    onError: () => () => undefined,
    onClosed: (fn) => {
      h.closed.push(fn);
      return () => undefined;
    },
  };
  return {
    controller: new RealtimeAssistantController(ThreadId.make("thread-1"), transport, player),
    h,
    sent,
    played,
    get stops() {
      return stops;
    },
  };
}

describe("RealtimeAssistantController", () => {
  it("starts, bounds frames, plays audio, and stops cleanly", async () => {
    const f = fixture();
    await f.controller.start();
    expect(f.controller.getState().status).toBe("active");
    expect(
      await f.controller.submitFrame({ data: "AA==", sampleRate: 24000, numChannels: 1 }),
    ).toBe(true);
    expect(
      await f.controller.submitFrame({
        data: "x".repeat(32001),
        sampleRate: 24000,
        numChannels: 1,
      }),
    ).toBe(false);
    f.h.audio[0]({ data: "AQ==", sampleRate: 24000, numChannels: 1 });
    expect(f.played).toHaveLength(1);
    await f.controller.stop();
    expect(f.controller.getState().status).toBe("stopped");
    expect(f.stops).toBe(1);
  });
  it("suppresses capture and playback while muted", async () => {
    const f = fixture();
    await f.controller.start();
    f.controller.setMicMuted(true);
    expect(
      await f.controller.submitFrame({ data: "AA==", sampleRate: 24000, numChannels: 1 }),
    ).toBe(false);
    f.controller.setAssistantMuted(true);
    f.h.audio[0]({ data: "AQ==", sampleRate: 24000, numChannels: 1 });
    expect(f.played).toHaveLength(0);
  });
  it("activates and plays only from actual normalized realtime state", async () => {
    const f = fixture();
    await f.controller.start();
    const audio = { data: "AQ==", sampleRate: 24000, numChannels: 1 };
    f.controller.applyRealtimeState({
      threadId: ThreadId.make("thread-1"),
      status: "active",
      realtimeSessionId: "rt-1",
      items: [{ role: "assistant" }],
      audio: [audio],
      error: undefined,
    } satisfies ClientRealtimeState);
    expect(f.controller.getState().status).toBe("active");
    expect(f.controller.getState().sessionId).toBe("rt-1");
    expect(f.played).toEqual([audio]);
    f.controller.applyRealtimeState({
      threadId: ThreadId.make("thread-1"),
      status: "error",
      items: [],
      audio: [],
      error: "provider failed",
    } satisfies ClientRealtimeState);
    expect(f.controller.getState().status).toBe("error");
    expect(f.controller.getState().error).toBe("provider failed");
  });
});
