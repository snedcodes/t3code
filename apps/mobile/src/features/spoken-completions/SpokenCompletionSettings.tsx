import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/unstable/reactivity";
import { Alert, Platform } from "react-native";
import type { Preferences } from "../../persistence/mobile-preferences";
import { mobilePreferencesAtom, updateMobilePreferencesAtom } from "../../state/preferences";
import { SettingsRow } from "../settings/components/SettingsRow";
import { SettingsSection } from "../settings/components/SettingsSection";
import { SettingsSwitchRow } from "../settings/components/SettingsSwitchRow";
import { nativeSpeech } from "./native";
import { resolveSpokenCompletionPreferences } from "./preferences";

export function SpokenCompletionSettings() {
  const result = useAtomValue(mobilePreferencesAtom);
  const save = useAtomSet(updateMobilePreferencesAtom);
  if (Platform.OS !== "android") return null;
  const ready = AsyncResult.isSuccess(result);
  const values = resolveSpokenCompletionPreferences(ready ? result.value : {});
  const available = nativeSpeech.available;
  const patch = (value: Partial<Preferences>) => {
    // Turning Off stops playback immediately; persistence mirrors the setting on launch.
    if (value.spokenCompletionAlertsEnabled === false) nativeSpeech.stop();
    save(value);
  };
  const choose = (
    label: string,
    key: "spokenCompletionVolume" | "spokenCompletionRate" | "spokenCompletionPitch",
    options: number[],
  ) =>
    Alert.alert(
      label,
      "Uses the Android text-to-speech voice.",
      options.map((value) => ({ text: `${value}`, onPress: () => patch({ [key]: value }) })),
      { cancelable: true },
    );
  return (
    <SettingsSection title="Spoken completions">
      <SettingsSwitchRow
        icon="speaker.wave.2"
        label="Speak agent completions"
        disabled={!ready || !available}
        value={available && values.enabled}
        subtitle={
          available
            ? "Reads completion and failure notifications in the background. Device Notifications must be enabled."
            : "Requires a newer Android app build."
        }
        onValueChange={(enabled) => patch({ spokenCompletionAlertsEnabled: enabled })}
      />
      {values.enabled && available ? (
        <>
          <SettingsRow
            icon="speaker.wave.2"
            label="Speech volume"
            value={`${Math.round(values.volume * 100)}%`}
            onPress={() => choose("Speech volume", "spokenCompletionVolume", [0.25, 0.5, 1])}
          />
          <SettingsRow
            icon="speaker.wave.2"
            label="Speech rate"
            value={`${values.rate}x`}
            onPress={() => choose("Speech rate", "spokenCompletionRate", [0.75, 1, 1.25])}
          />
          <SettingsRow
            icon="speaker.wave.2"
            label="Speech pitch"
            value={`${values.pitch}x`}
            onPress={() => choose("Speech pitch", "spokenCompletionPitch", [0.75, 1, 1.25])}
          />
        </>
      ) : null}
    </SettingsSection>
  );
}
