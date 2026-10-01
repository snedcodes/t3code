import { describe, expect, it } from "vite-plus/test";
import {
  resolveSpokenCompletionPreferences,
  sanitizeSpokenCompletionPreferences,
} from "./preferences";

describe("spoken completion preferences", () => {
  it("defaults Off without changing notification preferences", () => {
    expect(resolveSpokenCompletionPreferences({ liveActivitiesEnabled: true })).toEqual({
      enabled: false,
      volume: 1,
      rate: 1,
      pitch: 1,
      voice: null,
    });
  });
  it("retains opt-in and bounds persisted speech controls", () => {
    expect(
      resolveSpokenCompletionPreferences({
        spokenCompletionAlertsEnabled: true,
        spokenCompletionVolume: 3,
        spokenCompletionRate: -1,
        spokenCompletionPitch: NaN,
        spokenCompletionVoice: "  device-voice  ",
      }),
    ).toEqual({ enabled: true, volume: 1, rate: 0.5, pitch: 1, voice: "device-voice" });
    expect(
      sanitizeSpokenCompletionPreferences({ spokenCompletionVolume: Infinity })
        .spokenCompletionVolume,
    ).toBeUndefined();
  });
});
