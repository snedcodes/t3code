import { Platform } from "react-native";
import { NativeModules } from "react-native";
type NativeSpeech = { speak(text: string): void; stop(): void };
let module: NativeSpeech | null = null;
if (Platform.OS === "android") {
  try {
    module = NativeModules.T3SpokenCompletions as NativeSpeech;
  } catch {}
}
export const nativeSpeech = {
  speak: (text: string) => module?.speak(text),
  stop: () => module?.stop(),
};
