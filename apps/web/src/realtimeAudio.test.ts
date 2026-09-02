import { describe, expect, it } from "@effect/vitest";
import { ThreadId } from "@t3tools/contracts";
import { createRealtimeState } from "@t3tools/client-runtime/state/realtime";
import {
  RealtimeVoiceController,
  type PcmFrame,
  type PcmPlayer,
  type VoiceTransport,
} from "./realtimeAudio";

describe("RealtimeVoiceController", () => {
  it("keeps exact thread transport and bounds frames", async () => {
    const started = new Set<(id: string) => void>();
    const closed = new Set<() => void>();
    const sent: PcmFrame[] = [];
    const transport: VoiceTransport = {
      start: async () => {
        started.forEach((listener) => listener("session-1"));
      },
      appendAudio: async (frame) => {
        sent.push(frame);
      },
      stop: async () => closed.forEach((listener) => listener()),
      onStarted: (listener) => (started.add(listener), () => started.delete(listener)),
      onAudio: () => () => undefined,
      onError: () => () => undefined,
      onClosed: (listener) => (closed.add(listener), () => closed.delete(listener)),
    };
    const player: PcmPlayer = { play: () => undefined, stop: () => undefined };
    const controller = new RealtimeVoiceController(ThreadId.make("thread-1"), transport, player);
    await controller.start();
    expect(controller.getState().status).toBe("active");
    expect(await controller.submitFrame({ data: "AA==", sampleRate: 24000, numChannels: 1 })).toBe(
      true,
    );
    expect(sent).toHaveLength(1);
    expect(
      await controller.submitFrame({ data: "x".repeat(32001), sampleRate: 24000, numChannels: 1 }),
    ).toBe(false);
    controller.setMicMuted(true);
    expect(await controller.submitFrame({ data: "AA==", sampleRate: 24000, numChannels: 1 })).toBe(
      false,
    );
    await controller.stop();
    expect(controller.getState().status).toBe("stopped");
  });

  it("folds actual realtime state into activation, ephemeral playback, and lifecycle", () => {
    const played: string[] = [];
    const player: PcmPlayer = { play: (chunk) => played.push(chunk.data), stop: () => undefined };
    const transport: VoiceTransport = {
      start: async () => undefined,
      appendAudio: async () => undefined,
      stop: async () => undefined,
      onStarted: () => () => undefined,
      onAudio: () => () => undefined,
      onError: () => () => undefined,
      onClosed: () => () => undefined,
    };
    const controller = new RealtimeVoiceController(ThreadId.make("thread-3"), transport, player);
    const initial = createRealtimeState(ThreadId.make("thread-3"));
    controller.applyRealtimeState({
      ...initial,
      status: "active",
      realtimeSessionId: "session-3",
      audio: [{ data: "one", sampleRate: 24000, numChannels: 1 }],
    });
    expect(controller.getState()).toMatchObject({ status: "active", sessionId: "session-3" });
    expect(played).toEqual(["one"]);
    controller.applyRealtimeState({
      ...initial,
      status: "active",
      realtimeSessionId: "session-3",
      audio: [
        { data: "one", sampleRate: 24000, numChannels: 1 },
        { data: "two", sampleRate: 24000, numChannels: 1 },
      ],
    });
    expect(played).toEqual(["one", "two"]);
    controller.applyRealtimeState({ ...initial, status: "error", error: "provider unavailable" });
    expect(controller.getState()).toMatchObject({ status: "error", error: "provider unavailable" });
    controller.applyRealtimeState({ ...initial, status: "stopped" });
    expect(controller.getState().status).toBe("stopped");
  });
});
