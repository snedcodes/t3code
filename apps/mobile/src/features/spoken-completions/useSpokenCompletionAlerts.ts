import { AsyncResult } from "effect/unstable/reactivity";
import { useEffect, useRef } from "react";
import type { Preferences } from "../../persistence/mobile-preferences";
import { native } from "./controllerRuntime";
import { SpokenCompletionController } from "./spokenCompletionController";

export function useSpokenCompletionAlertsEnabled(preferences: AsyncResult.AsyncResult<Preferences, unknown>): boolean {
  return AsyncResult.isSuccess(preferences) && preferences.value.spokenCompletionAlertsEnabled === true;
}

export function useSpokenCompletionAlerts(input: {
  readonly enabled: boolean;
  readonly environmentId: string;
  readonly environmentLabel: string | null;
  readonly threadId: string;
  readonly threadLabel: string;
  readonly latestTurn: { readonly turnId: string | null; readonly state: string; readonly completedAt: string | null } | null;
}): void {
  const controller = useRef<SpokenCompletionController | null>(null);
  if (!controller.current) controller.current = new SpokenCompletionController(native);
  const previous = useRef<string | null>(null);
  useEffect(() => {
    const turn = input.latestTurn;
    if (!input.enabled || !turn?.turnId || !turn.completedAt || turn.state === "running") return;
    const key = `${input.threadId}:${turn.turnId}`;
    if (previous.current === key) return;
    previous.current = key;
    controller.current?.completion({
      environmentId: input.environmentId,
      environmentLabel: input.environmentLabel,
      threadId: input.threadId,
      threadLabel: input.threadLabel,
      turnId: turn.turnId,
    });
  }, [input]);
}
