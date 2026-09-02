import { useEffect, useRef } from "react";
import { SpokenCompletionController } from "./spokenCompletionController";
import { nativeSpeech } from "./native";
export function useSpokenCompletionAlerts(input: {
  enabled: boolean;
  environmentId: string;
  threadId: string;
  threadLabel: string;
  latestTurn: { turnId: string | null; completedAt: string | null; state: string } | null;
}) {
  const controller = useRef<SpokenCompletionController | null>(null);
  if (!controller.current) controller.current = new SpokenCompletionController(nativeSpeech);
  const seen = useRef<string | null>(null);
  useEffect(() => {
    const turn = input.latestTurn;
    if (!input.enabled || !turn?.turnId || !turn.completedAt || turn.state === "running") return;
    const key = `${input.threadId}:${turn.turnId}`;
    if (seen.current === key) return;
    seen.current = key;
    controller.current?.completion({
      environmentId: input.environmentId,
      threadId: input.threadId,
      threadLabel: input.threadLabel,
      turnId: turn.turnId,
    });
  }, [input]);
}
