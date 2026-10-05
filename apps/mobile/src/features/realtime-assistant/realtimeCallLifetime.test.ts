import { expect, it, vi } from "vite-plus/test";
import { RealtimeCallLifetime, type RealtimeCallControl } from "./realtimeCallLifetime";
import { RealtimeVoiceCues } from "./realtimeVoiceCues";

it("retains the existing foreground call through background/reconnect and ends only the matching owned call", async () => {
  let foreground = true;
  let event!: (event: RealtimeCallControl) => void;
  const order: string[] = [];
  const permission = vi.fn(async () => {
    order.push("permission");
    return true;
  });
  const unsubscribe = vi.fn();
  const native = {
    start: vi.fn(async (_owner: string) => {
      order.push("service-active");
      return true;
    }),
    stop: vi.fn(),
    isActive: vi.fn(() => true),
    subscribe: vi.fn((listener: typeof event) => {
      event = listener;
      return unsubscribe;
    }),
  };
  const play = vi.fn();
  const cues = new RealtimeVoiceCues(play);
  const onEnd = vi.fn(() => {
    call.end();
    cues.stop();
  });
  const call = new RealtimeCallLifetime({
    native,
    identity: () => "owned-call",
    foreground: () => foreground,
    microphonePermission: permission,
    onEnd,
  });
  await call.start();
  expect(order).toEqual(["permission", "service-active"]);
  cues.update({ status: "active", sessionId: "session-1" });
  foreground = false; // background/minimized keeps the same owner and listener
  await call.beforeReconnect(new AbortController().signal);
  cues.update({ status: "reconnecting", sessionId: null });
  cues.update({ status: "active", sessionId: "session-2" });
  expect(permission).toHaveBeenCalledOnce();
  expect(native.start).toHaveBeenCalledOnce();
  expect(native.isActive).toHaveBeenCalledWith("owned-call");
  expect(native.stop).not.toHaveBeenCalled();
  expect(play.mock.calls).toEqual([[true]]);
  event({ ownerId: "stale-call", reason: "user-stop" });
  expect(onEnd).not.toHaveBeenCalled();
  event({ ownerId: "owned-call", reason: "user-stop" }); // notification explicit End
  call.end(); // later dispose/cleanup is idempotent
  cues.update({ status: "stopped", sessionId: null });
  expect(native.stop).toHaveBeenCalledExactlyOnceWith("owned-call");
  expect(unsubscribe).toHaveBeenCalledOnce();
  expect(play.mock.calls).toEqual([[true], [false]]);
  await expect(call.beforeReconnect(new AbortController().signal)).rejects.toThrow(
    "no longer active",
  );
  await expect(call.start()).rejects.toThrow("visible");
  expect(permission).toHaveBeenCalledOnce();
});
