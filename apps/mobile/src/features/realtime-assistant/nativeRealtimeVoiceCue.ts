import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";

type CueModule = { playRealtimeVoiceCue?: (active: boolean) => boolean };

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
