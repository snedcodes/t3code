import { NativeModules, PermissionsAndroid, Platform } from "react-native";
import type {
  PcmFrame,
  PcmPlayer,
} from "../../../src/features/realtime-assistant/realtimeAssistantController";

export const REALTIME_AUDIO_UNAVAILABLE = "Native realtime audio is not installed in this build.";

export async function requestMicrophonePermission(): Promise<boolean> {
  if (Platform.OS !== "android") return true;
  return (
    (await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO)) ===
    PermissionsAndroid.RESULTS.GRANTED
  );
}

export function createNativeRealtimeAudio(): {
  capture(onFrame: (frame: PcmFrame) => void): Promise<() => void>;
  player: PcmPlayer;
} {
  const native = NativeModules.T3RealtimeAudio as
    | {
        startCapture?: (onFrame: (frame: PcmFrame) => void) => Promise<void>;
        stopCapture?: () => void;
        playPcm?: (chunk: unknown) => void;
        stopPlayback?: () => void;
      }
    | undefined;
  return {
    capture: async (onFrame) => {
      if (!native?.startCapture) throw new Error(REALTIME_AUDIO_UNAVAILABLE);
      await native.startCapture(onFrame);
      return () => native.stopCapture?.();
    },
    player: { play: (chunk) => native?.playPcm?.(chunk), stop: () => native?.stopPlayback?.() },
  };
}
