import { useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/unstable/reactivity";
import { useEffect } from "react";
import { AppState } from "react-native";
import { environmentCatalog } from "../../connection/catalog";
import { useSavedRemoteConnections } from "../../state/use-remote-environment-registry";
import { directBackground } from "./directBackground";
import { mobilePreferencesAtom } from "../../state/preferences";
import { nativeSpeech } from "./native";
import { resolveSpokenCompletionPreferences } from "./preferences";

/** Mirrors loaded device preferences to the native background notification owner. */
export function SpokenCompletionPreferencesCoordinator() {
  const result = useAtomValue(mobilePreferencesAtom);
  const catalog = useAtomValue(environmentCatalog.catalogValueAtom);
  const { savedConnectionsById, isLoadingSavedConnection } = useSavedRemoteConnections();
  const preferences = AsyncResult.isSuccess(result) ? result.value : null;
  const loaded = preferences !== null;
  const { enabled, volume, rate, pitch, voice } = resolveSpokenCompletionPreferences(
    preferences ?? {},
  );
  useEffect(() => {
    if (loaded) nativeSpeech.configure({ enabled, volume, rate, pitch, voice });
  }, [loaded, enabled, volume, rate, pitch, voice]);
  const connections = JSON.stringify(
    Object.values(savedConnectionsById)
      .filter(
        (connection) =>
          catalog.entries.get(connection.environmentId)?.enabled &&
          !connection.relayManaged &&
          connection.authenticationMethod !== "dpop",
      )
      .sort((a, b) => a.environmentId.localeCompare(b.environmentId))
      .map((connection) => ({
        environmentId: connection.environmentId,
        label: connection.environmentLabel,
        httpBaseUrl: connection.httpBaseUrl,
        bearerToken: connection.bearerToken,
      })),
  );
  useEffect(() => {
    if (!loaded || isLoadingSavedConnection) return;
    const sync = () => {
      if (!enabled || AppState.currentState === "active")
        directBackground.configure(enabled, connections);
    };
    sync();
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") sync();
    });
    return () => listener.remove();
  }, [loaded, isLoadingSavedConnection, enabled, connections]);
  return null;
}
