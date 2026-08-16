import type { OrchestrationSession } from "@t3tools/contracts";

/**
 * The initial operator policy for a turn that appears to be working without
 * receiving a newer native session update.
 *
 * This is deliberately only a decision model. It does not observe a session,
 * interrupt a turn, or resend a prompt.
 */
export const DEFAULT_HUNG_TURN_THRESHOLD_MS = 2 * 60 * 1000;

export type HungTurnAssessmentState = "not-running" | "working" | "stale" | "unknown";

export type HungTurnAssessment = {
  state: HungTurnAssessmentState;
  thresholdMs: number;
  elapsedMs: number | null;
  canInterrupt: boolean;
  recommendedAction: "none" | "observe" | "stop-and-review";
};

export function assessHungTurn(
  session: Pick<OrchestrationSession, "status" | "activeTurnId" | "updatedAt"> | null,
  options: { now?: number; thresholdMs?: number } = {},
): HungTurnAssessment {
  const thresholdMs = options.thresholdMs ?? DEFAULT_HUNG_TURN_THRESHOLD_MS;
  const notRunning = {
    state: "not-running" as const,
    thresholdMs,
    elapsedMs: null,
    canInterrupt: false,
    recommendedAction: "none" as const,
  };

  if (!session || session.status !== "running") {
    return notRunning;
  }

  if (!session.activeTurnId) {
    return notRunning;
  }

  const updatedAtMs = Date.parse(session.updatedAt);
  if (!Number.isFinite(updatedAtMs)) {
    return {
      state: "unknown",
      thresholdMs,
      elapsedMs: null,
      canInterrupt: true,
      recommendedAction: "observe",
    };
  }

  const elapsedMs = Math.max(0, (options.now ?? Date.now()) - updatedAtMs);
  const stale = elapsedMs >= thresholdMs;
  return {
    state: stale ? "stale" : "working",
    thresholdMs,
    elapsedMs,
    canInterrupt: true,
    recommendedAction: stale ? "stop-and-review" : "observe",
  };
}
