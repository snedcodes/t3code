import * as Effect from "effect/Effect";
import { useEffect, useRef, useState } from "react";

import { runtime } from "../../lib/runtime";
import { MobilePreferencesStore } from "../../persistence/mobile-preferences";
import {
  patchRealtimePortfolioAccess,
  resolveRealtimePortfolioAccess,
} from "./realtimePortfolioPreferences";

/** Load before Start; save one assistant key through the existing atomic update. */
export function useRealtimePortfolioAccess(key: string) {
  const generation = useRef(0);
  const [state, setState] = useState({
    key: "",
    loaded: false,
    saving: false,
    enabled: true,
    error: null as string | null,
  });
  useEffect(() => {
    const ticket = ++generation.current;
    void runtime
      .runPromise(MobilePreferencesStore.pipe(Effect.flatMap((store) => store.load)))
      .then(
        (preferences) => {
          if (ticket === generation.current)
            setState({
              key,
              loaded: true,
              saving: false,
              enabled: resolveRealtimePortfolioAccess(preferences, key),
              error: null,
            });
        },
        () => {
          if (ticket === generation.current)
            setState({
              key,
              loaded: false,
              saving: false,
              enabled: true,
              error: "Could not load voice access preference. Close and reopen voice to retry.",
            });
        },
      );
    return () => {
      generation.current += 1;
    };
  }, [key]);
  const setEnabled = (enabled: boolean) => {
    if (state.key !== key || !state.loaded || state.saving) return;
    const ticket = ++generation.current;
    setState({ ...state, enabled, saving: true, error: null });
    void runtime
      .runPromise(
        MobilePreferencesStore.pipe(
          Effect.flatMap((store) =>
            store.update((current) => patchRealtimePortfolioAccess(current, key, enabled)),
          ),
        ),
      )
      .then(
        () => {
          if (ticket === generation.current) setState((current) => ({ ...current, saving: false }));
        },
        () => {
          if (ticket === generation.current)
            setState((current) => ({
              ...current,
              saving: false,
              error:
                "Could not save voice access preference. This choice applies here but may reset when reopened.",
            }));
        },
      );
  };
  return {
    enabled: state.key === key ? state.enabled : true,
    ready: state.key === key && state.loaded && !state.saving,
    saving: state.key === key && state.saving,
    error: state.key === key ? state.error : null,
    setEnabled,
  };
}
