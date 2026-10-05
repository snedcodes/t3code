import { expect, it, vi } from "vite-plus/test";
import { RealtimeVoiceCues, voiceAudioFocusStopReason } from "./realtimeVoiceCues";

it("cues actual activation and one deactivation across stop, error, close and failed starts", () => {
  const play = vi.fn();
  const cues = new RealtimeVoiceCues(play);
  cues.update({ status: "starting", sessionId: null });
  cues.update({ status: "error", sessionId: null });
  cues.stop();
  expect(play).not.toHaveBeenCalled();
  cues.update({ status: "active", sessionId: "actual-session" });
  cues.update({ status: "active", sessionId: "actual-session" });
  cues.update({ status: "stopping", sessionId: null });
  cues.update({ status: "stopped", sessionId: null });
  cues.stop();
  expect(play.mock.calls).toEqual([[true], [false]]);
  cues.update({ status: "active", sessionId: "next-session" });
  cues.update({ status: "error", sessionId: null });
  cues.stop();
  cues.update({ status: "active", sessionId: "third-session" });
  cues.stop(); // close/background/unmount fallback before unsubscribe/dispose
  cues.update({ status: "stopped", sessionId: null });
  expect(play.mock.calls).toEqual([[true], [false], [true], [false], [true], [false]]);
  expect(voiceAudioFocusStopReason(-1)).toContain("focus was lost");
  expect(voiceAudioFocusStopReason(-2)).toContain("temporarily interrupted");
  expect(voiceAudioFocusStopReason(-3)).toContain("reduced playback");
});
