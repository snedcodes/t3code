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

export type HungTurnRecoveryAction = "none" | "warn-review" | "interrupt-and-retry";

export function decideHungTurnRecovery(
  assessment: HungTurnAssessment,
  options: {
    autoResendEnabled: boolean;
    hasToolActivity: boolean;
    alreadyAttempted: boolean;
    blockedByInteraction?: boolean;
  },
): HungTurnRecoveryAction {
  if (
    !options.autoResendEnabled ||
    options.alreadyAttempted ||
    options.blockedByInteraction === true
  ) {
    return "none";
  }
  if (assessment.state !== "stale") {
    return "none";
  }
  return options.hasToolActivity ? "warn-review" : "interrupt-and-retry";
}

export function assessHungTurn(
  session: Pick<OrchestrationSession, "status" | "activeTurnId" | "updatedAt"> | null,
  options: {
    now?: number;
    thresholdMs?: number;
    lastProgressAt?: string | null;
    hasActiveWork?: boolean;
  } = {},
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

  const observationTimes = [session.updatedAt, options.lastProgressAt ?? null]
    .map((timestamp) => (timestamp === null ? Number.NaN : Date.parse(timestamp)))
    .filter((timestamp): timestamp is number => Number.isFinite(timestamp));
  const lastObservedProgressMs = observationTimes.length > 0 ? Math.max(...observationTimes) : null;
  if (options.hasActiveWork) {
    return {
      state: "working",
      thresholdMs,
      elapsedMs:
        lastObservedProgressMs === null
          ? null
          : Math.max(0, (options.now ?? Date.now()) - lastObservedProgressMs),
      canInterrupt: true,
      recommendedAction: "observe",
    };
  }
  if (lastObservedProgressMs === null) {
    return {
      state: "unknown",
      thresholdMs,
      elapsedMs: null,
      canInterrupt: true,
      recommendedAction: "observe",
    };
  }

  const elapsedMs = Math.max(0, (options.now ?? Date.now()) - lastObservedProgressMs);
  const stale = elapsedMs >= thresholdMs;
  return {
    state: stale ? "stale" : "working",
    thresholdMs,
    elapsedMs,
    canInterrupt: true,
    recommendedAction: stale ? "stop-and-review" : "observe",
  };
}
