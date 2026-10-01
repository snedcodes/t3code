import type { Preferences } from "../../persistence/mobile-preferences";

export function sanitizeSpokenCompletionPreferences(parsed: Preferences): Partial<Preferences> {
  const result: Partial<Preferences> =
    typeof parsed.spokenCompletionAlertsEnabled === "boolean"
      ? { spokenCompletionAlertsEnabled: parsed.spokenCompletionAlertsEnabled }
      : {};
  const bounded = (value: unknown, min: number, max: number) =>
    typeof value === "number" && Number.isFinite(value)
      ? Math.min(max, Math.max(min, value))
      : undefined;
  return {
    ...result,
    spokenCompletionVolume: bounded(parsed.spokenCompletionVolume, 0, 1),
    spokenCompletionRate: bounded(parsed.spokenCompletionRate, 0.5, 2),
    spokenCompletionPitch: bounded(parsed.spokenCompletionPitch, 0.5, 2),
    spokenCompletionVoice:
      typeof parsed.spokenCompletionVoice === "string" && parsed.spokenCompletionVoice.trim()
        ? parsed.spokenCompletionVoice.trim().slice(0, 256)
        : undefined,
  };
}

export function resolveSpokenCompletionPreferences(parsed: Preferences) {
  const preferences = sanitizeSpokenCompletionPreferences(parsed);
  return {
    enabled: preferences.spokenCompletionAlertsEnabled === true,
    volume: preferences.spokenCompletionVolume ?? 1,
    rate: preferences.spokenCompletionRate ?? 1,
    pitch: preferences.spokenCompletionPitch ?? 1,
    voice: preferences.spokenCompletionVoice ?? null,
  };
}
