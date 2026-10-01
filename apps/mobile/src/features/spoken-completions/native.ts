import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";

export interface NativeSpeechSettings {
  enabled: boolean;
  /** Between 0 and 1. */
  volume?: number;
  /** Android TTS multiplier, where 1 is normal. */
  rate?: number;
  /** Android TTS multiplier, where 1 is normal. */
  pitch?: number;
  /** Android TTS voice name. Null restores the default voice. */
  voice?: string | null;
}

export interface NativeSpeechStatus {
  identity: string;
  status: "start" | "done" | "error" | "stopped";
  error?: string;
}

type NativeSpeechModule = {
  configureSpokenCompletions(
    enabled: boolean,
    volume: number,
    rate: number,
    pitch: number,
    voice: string | null,
  ): void;
  stopSpokenCompletions(): void;
  addListener(
    event: "onSpokenCompletionStatus",
    listener: (event: NativeSpeechStatus) => void,
  ): { remove(): void };
};

const module =
  Platform.OS === "android"
    ? requireOptionalNativeModule<NativeSpeechModule>("T3AgentNotifications")
    : null;

const available =
  typeof module?.configureSpokenCompletions === "function" &&
  typeof module?.stopSpokenCompletions === "function";

// FCM speaks through the native singleton, including while JS is not running.
export const nativeSpeech = {
  available,
  configure(settings: NativeSpeechSettings): void {
    if (!available) return;
    module?.configureSpokenCompletions(
      settings.enabled,
      settings.volume ?? 1,
      settings.rate ?? 1,
      settings.pitch ?? 1,
      settings.voice ?? null,
    );
  },
  stop(): void {
    if (available) module?.stopSpokenCompletions();
  },
  addListener(listener: (event: NativeSpeechStatus) => void): { remove(): void } {
    return available && typeof module?.addListener === "function"
      ? module.addListener("onSpokenCompletionStatus", listener)
      : { remove() {} };
  },
};
