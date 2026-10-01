import type { Preferences } from "../../persistence/mobile-preferences";

export function realtimeAssistantPreferenceKey(
  environmentId: string,
  projectId: string,
  threadId: string,
) {
  return JSON.stringify([environmentId, projectId, threadId]);
}

export function resolveRealtimePortfolioAccess(preferences: Preferences, key: string): boolean {
  return preferences.realtimePortfolioAccessByAssistant?.[key] !== false;
}

/** Used inside MobilePreferencesStore.update, against the locked current blob. */
export function patchRealtimePortfolioAccess(
  preferences: Preferences,
  key: string,
  enabled: boolean,
): Partial<Preferences> {
  return {
    realtimePortfolioAccessByAssistant: {
      ...preferences.realtimePortfolioAccessByAssistant,
      [key]: enabled,
    },
  };
}
