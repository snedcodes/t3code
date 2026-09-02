import { Platform } from "react-native";
import { requireNativeModule } from "expo-modules-core";

type NativeSpokenCompletions = { speak(text: string): void; stop(): void };
let native: NativeSpokenCompletions | null = null;
if (Platform.OS === "android") {
  try { native = requireNativeModule<NativeSpokenCompletions>("T3SpokenCompletions"); } catch { native = null; }
}
export const speak = (text: string) => native?.speak(text);
export const stop = () => native?.stop();
