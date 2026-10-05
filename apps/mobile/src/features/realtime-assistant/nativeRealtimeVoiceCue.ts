import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";

type CueModule = {
  playRealtimeVoiceCue?: (active: boolean) => boolean;
  waitForRealtimeVoiceCue?: () => Promise<unknown>;
};

/** Older native builds keep voice working without audible transition feedback. */
export function playRealtimeVoiceCue(active: boolean): void {
  if (Platform.OS !== "android") return;
  try {
    const module = requireOptionalNativeModule<CueModule>("T3AgentNotifications");
    if (typeof module?.playRealtimeVoiceCue === "function") module.playRealtimeVoiceCue(active);
  } catch {
    /* A missing or unavailable tone never changes the call lifecycle. */
  }
}

/** Hold existing call routing only until the current finite End cue is released. */
export async function waitForRealtimeVoiceCue(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    const module = requireOptionalNativeModule<CueModule>("T3AgentNotifications");
    if (typeof module?.waitForRealtimeVoiceCue === "function") {
      await module.waitForRealtimeVoiceCue();
    }
  } catch {
    /* Older builds or failed optional feedback must never block audio cleanup. */
  }
}
