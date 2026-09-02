import { describe, expect, it } from "@effect/vitest";
import { ThreadId } from "@t3tools/contracts";
import { createT3VoiceTransport, RealtimeVoiceController, type PcmFrame, type PcmPlayer, type VoiceTransport } from "./realtimeAudio";

describe("RealtimeVoiceController", () => {
  it("keeps exact thread transport and bounds frames", async () => {
    const started = new Set<(id: string) => void>(); const closed = new Set<() => void>(); const sent: PcmFrame[] = [];
    const transport: VoiceTransport = { start: async (input) => { expect(input.threadId).toBe("thread-1"); started.forEach((listener) => listener("synthetic-1")); }, appendAudio: async (frame) => { sent.push(frame); }, stop: async () => closed.forEach((listener) => listener()), onStarted: (listener) => (started.add(listener), () => started.delete(listener)), onAudio: () => () => undefined, onError: () => () => undefined, onClosed: (listener) => (closed.add(listener), () => closed.delete(listener)) };
    const player: PcmPlayer = { play: () => undefined, stop: () => undefined }; const controller = new RealtimeVoiceController(ThreadId.make("thread-1"), transport, player);
    await controller.start(); expect(controller.getState().status).toBe("active"); expect(await controller.submitFrame({ data: "AA==", sampleRate: 24000, numChannels: 1 })).toBe(true); expect(sent).toHaveLength(1); expect(await controller.submitFrame({ data: "x".repeat(32001), sampleRate: 24000, numChannels: 1 })).toBe(false); controller.setMicMuted(true); expect(await controller.submitFrame({ data: "AA==", sampleRate: 24000, numChannels: 1 })).toBe(false); await controller.stop(); expect(controller.getState().status).toBe("stopped");
  });

  it("dispatches the normal T3 commands without fabricating provider events", async () => {
    const calls: string[] = [];
    const transport = createT3VoiceTransport(ThreadId.make("thread-2"), {
      start: async (input) => { calls.push(`start:${input.threadId}`); },
      appendAudio: async (input) => { calls.push(`append:${input.threadId}:${input.audio.data}`); },
      stop: async (input) => { calls.push(`stop:${input.threadId}`); },
    });
    let started = 0;
    transport.onStarted(() => { started += 1; });
    await transport.start({ threadId: ThreadId.make("thread-2"), outputModality: "audio" });
    await transport.appendAudio({ data: "AA==", sampleRate: 24000, numChannels: 1 });
    await transport.stop();
    expect(calls).toEqual(["start:thread-2", "append:thread-2:AA==", "stop:thread-2"]);
    expect(started).toBe(0);
  });
});
