import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { vi } from "vite-plus/test";

vi.mock("expo-secure-store", () => ({}));
vi.mock("react-native", () => ({ Platform: { OS: "android" } }));

import { make } from "./mobile-preferences";
import { MobileDatabase, type StoredPreferencesJson } from "./mobile-database";
import { MobileSecureStorage } from "./mobile-secure-storage";
import {
  patchRealtimePortfolioAccess,
  realtimeAssistantPreferenceKey,
  resolveRealtimePortfolioAccess,
} from "../features/realtime-assistant/realtimePortfolioPreferences";

function preferencesStore(initial: unknown) {
  let stored: StoredPreferencesJson = { payload: JSON.stringify(initial), updatedAt: 1 };
  const unused = () => Effect.die("Unexpected cache access");
  const database = MobileDatabase.of({
    loadCache: unused,
    listCache: unused,
    saveCache: unused,
    removeCache: unused,
    clearCacheKind: unused,
    clearEnvironmentCache: unused,
    clearAllCaches: unused(),
    inspectCaches: unused(),
    loadPreferencesJson: Effect.sync(() => Option.some(stored)),
    savePreferencesJson: (payload, updatedAt) =>
      Effect.sync(() => {
        stored = { payload, updatedAt };
      }),
  });
  const secure = MobileSecureStorage.of({
    getItem: () => Effect.succeed(null),
    setItem: () => Effect.void,
    removeItem: () => Effect.void,
  });
  return make().pipe(
    Effect.provideService(MobileDatabase, database),
    Effect.provideService(MobileSecureStorage, secure),
  );
}

describe("durable per-assistant realtime portfolio preference", () => {
  it.effect("loads only actual booleans, defaults absent to On and preserves existing fields", () =>
    Effect.gen(function* () {
      const key = realtimeAssistantPreferenceKey("environment", "project", "thread");
      const store = yield* preferencesStore({
        baseFontSize: 17,
        codeWordBreak: true,
        spokenCompletionAlertsEnabled: false,
        realtimePortfolioAccessByAssistant: {
          [key]: false,
          enabled: true,
          invalid: "false",
          number: 0,
          empty: null,
        },
      });
      const preferences = yield* store.load;
      expect(preferences).toMatchObject({
        baseFontSize: 17,
        codeWordBreak: true,
        spokenCompletionAlertsEnabled: false,
        realtimePortfolioAccessByAssistant: { [key]: false, enabled: true },
      });
      expect(Object.keys(preferences.realtimePortfolioAccessByAssistant!)).toHaveLength(2);
      expect(resolveRealtimePortfolioAccess(preferences, key)).toBe(false);
      expect(resolveRealtimePortfolioAccess(preferences, "absent")).toBe(true);
      expect(key).toBe(JSON.stringify(["environment", "project", "thread"]));
      expect(realtimeAssistantPreferenceKey("a:b", "c", "d")).not.toBe(
        realtimeAssistantPreferenceKey("a", "b:c", "d"),
      );
    }),
  );

  it.effect(
    "merges concurrent assistant opt-outs against the locked current blob and reloads Off",
    () =>
      Effect.gen(function* () {
        const store = yield* preferencesStore({ baseFontSize: 18, spokenCompletionVolume: 0.7 });
        const first = realtimeAssistantPreferenceKey("env", "project", "thread-1");
        const second = realtimeAssistantPreferenceKey("env", "project", "thread-2");
        yield* Effect.all(
          [
            store.update((current) => patchRealtimePortfolioAccess(current, first, false)),
            store.update((current) => patchRealtimePortfolioAccess(current, second, false)),
          ],
          { concurrency: "unbounded" },
        );
        const reloaded = yield* store.load;
        expect(reloaded).toMatchObject({
          baseFontSize: 18,
          spokenCompletionVolume: 0.7,
          realtimePortfolioAccessByAssistant: { [first]: false, [second]: false },
        });
        expect(resolveRealtimePortfolioAccess(reloaded, first)).toBe(false);
        expect(resolveRealtimePortfolioAccess(reloaded, second)).toBe(false);
        yield* store.update((current) => patchRealtimePortfolioAccess(current, first, true));
        expect((yield* store.load).realtimePortfolioAccessByAssistant).toEqual({
          [first]: true,
          [second]: false,
        });
      }),
  );
});
