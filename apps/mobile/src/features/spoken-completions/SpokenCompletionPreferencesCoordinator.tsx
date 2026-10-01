import { useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/unstable/reactivity";
import { useEffect } from "react";
import { mobilePreferencesAtom } from "../../state/preferences";
import { nativeSpeech } from "./native";
import { resolveSpokenCompletionPreferences } from "./preferences";

/** Mirrors loaded device preferences to the native background notification owner. */
export function SpokenCompletionPreferencesCoordinator() {
  const result = useAtomValue(mobilePreferencesAtom);
  const preferences = AsyncResult.isSuccess(result) ? result.value : null;
  const loaded = preferences !== null;
  const { enabled, volume, rate, pitch, voice } = resolveSpokenCompletionPreferences(
    preferences ?? {},
  );
  useEffect(() => {
    if (loaded) nativeSpeech.configure({ enabled, volume, rate, pitch, voice });
  }, [loaded, enabled, volume, rate, pitch, voice]);
  return null;
}
