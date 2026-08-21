import type {
  PortfolioHeartbeatReceipt,
  PortfolioHeartbeatReceiptStatus,
  PortfolioTarget,
} from "@t3tools/contracts";

export const PORTFOLIO_HEARTBEAT_LIFECYCLE_STATES = [
  "paused",
  "active",
  "stopped",
  "expired",
  "finished",
] as const;
export type PortfolioHeartbeatLifecycleState =
  (typeof PORTFOLIO_HEARTBEAT_LIFECYCLE_STATES)[number];

export const PORTFOLIO_HEARTBEAT_RECEIPT_STATUSES = [
  "accepted",
  "dispatched",
  "transcript-confirmed",
  "confirmation-delayed",
  "uncertain",
  "failed",
] as const satisfies ReadonlyArray<PortfolioHeartbeatReceiptStatus>;

export type PortfolioHeartbeatStopReason =
  | "manual-pause"
  | "manual-stop"
  | "expiry-reached"
  | "finish-line-reached"
  | "run-limit-reached"
  | "overlap-prevented"
  | "not-active"
  | "already-terminal"
  | "continue";

export type PortfolioHeartbeatLifecycle = {
  readonly target: PortfolioTarget;
  readonly state: PortfolioHeartbeatLifecycleState;
  readonly runCount: number;
  readonly maxRuns: number | null;
  readonly expiresAt: string | null;
  readonly finishLine: string | null;
  readonly finishLineReached: boolean;
  readonly activeRunId: string | null;
};

export type PortfolioHeartbeatLifecycleDecision = {
  readonly accepted: boolean;
  readonly state: PortfolioHeartbeatLifecycle;
  readonly reason: PortfolioHeartbeatStopReason;
};

export function createPausedPortfolioHeartbeatLifecycle(input: {
  readonly target: PortfolioTarget;
  readonly maxRuns?: number | null;
  readonly expiresAt?: string | null;
  readonly finishLine?: string | null;
}): PortfolioHeartbeatLifecycle {
  const maxRuns =
    input.maxRuns === null || input.maxRuns === undefined
      ? null
      : Math.max(0, Math.floor(input.maxRuns));
  return {
    target: input.target,
    state: "paused",
    runCount: 0,
    maxRuns,
    expiresAt: input.expiresAt ?? null,
    finishLine: input.finishLine ?? null,
    finishLineReached: false,
    activeRunId: null,
  };
}

function terminalState(state: PortfolioHeartbeatLifecycleState): boolean {
  return state === "stopped" || state === "expired" || state === "finished";
}

function expiryReached(lifecycle: PortfolioHeartbeatLifecycle, now: string): boolean {
  if (lifecycle.expiresAt === null) return false;
  const expiresAt = Date.parse(lifecycle.expiresAt);
  const current = Date.parse(now);
  return Number.isFinite(expiresAt) && Number.isFinite(current) && current >= expiresAt;
}

function runLimitReached(lifecycle: PortfolioHeartbeatLifecycle): boolean {
  return lifecycle.maxRuns !== null && lifecycle.runCount >= lifecycle.maxRuns;
}

function withState(
  lifecycle: PortfolioHeartbeatLifecycle,
  state: PortfolioHeartbeatLifecycleState,
  activeRunId: string | null = null,
): PortfolioHeartbeatLifecycle {
  return { ...lifecycle, state, activeRunId };
}

/**
 * Evaluates bounded stop conditions without starting work or changing external
 * state. This is the only lifecycle decision needed by a future owner/scheduler
 * adapter; the current slice deliberately has no scheduler.
 */
export function decidePortfolioHeartbeatStop(
  lifecycle: PortfolioHeartbeatLifecycle,
  now: string,
): PortfolioHeartbeatLifecycleDecision {
  if (terminalState(lifecycle.state)) {
    return { accepted: false, state: lifecycle, reason: "already-terminal" };
  }
  if (expiryReached(lifecycle, now)) {
    return { accepted: true, state: withState(lifecycle, "expired"), reason: "expiry-reached" };
  }
  if (lifecycle.finishLineReached) {
    return {
      accepted: true,
      state: withState(lifecycle, "finished"),
      reason: "finish-line-reached",
    };
  }
  if (runLimitReached(lifecycle)) {
    return {
      accepted: true,
      state: withState(lifecycle, "finished"),
      reason: "run-limit-reached",
    };
  }
  return { accepted: false, state: lifecycle, reason: "continue" };
}

export function decidePortfolioHeartbeatStart(
  lifecycle: PortfolioHeartbeatLifecycle,
  input: { readonly runId: string; readonly now: string },
): PortfolioHeartbeatLifecycleDecision {
  if (lifecycle.state === "active" || lifecycle.activeRunId !== null) {
    return { accepted: false, state: lifecycle, reason: "overlap-prevented" };
  }
  if (lifecycle.state !== "paused") {
    return { accepted: false, state: lifecycle, reason: "already-terminal" };
  }
  const stop = decidePortfolioHeartbeatStop(lifecycle, input.now);
  if (stop.reason !== "continue") return stop;
  return {
    accepted: true,
    state: { ...lifecycle, state: "active", activeRunId: input.runId },
    reason: "continue",
  };
}

export function decidePortfolioHeartbeatPause(
  lifecycle: PortfolioHeartbeatLifecycle,
): PortfolioHeartbeatLifecycleDecision {
  if (lifecycle.state === "active") {
    return { accepted: true, state: withState(lifecycle, "paused"), reason: "manual-pause" };
  }
  if (lifecycle.state === "paused") {
    return { accepted: false, state: lifecycle, reason: "manual-pause" };
  }
  return { accepted: false, state: lifecycle, reason: "already-terminal" };
}

export function decidePortfolioHeartbeatStopManually(
  lifecycle: PortfolioHeartbeatLifecycle,
): PortfolioHeartbeatLifecycleDecision {
  if (terminalState(lifecycle.state)) {
    return { accepted: false, state: lifecycle, reason: "already-terminal" };
  }
  return { accepted: true, state: withState(lifecycle, "stopped"), reason: "manual-stop" };
}

export function decidePortfolioHeartbeatRunCompletion(
  lifecycle: PortfolioHeartbeatLifecycle,
  input: {
    readonly runId: string;
    readonly completedAt: string;
    readonly finishLineReached?: boolean;
  },
): PortfolioHeartbeatLifecycleDecision {
  if (lifecycle.state !== "active" || lifecycle.activeRunId !== input.runId) {
    return { accepted: false, state: lifecycle, reason: "not-active" };
  }

  const completed = {
    ...lifecycle,
    runCount:
      lifecycle.maxRuns === null
        ? lifecycle.runCount + 1
        : Math.min(lifecycle.maxRuns, lifecycle.runCount + 1),
    finishLineReached: lifecycle.finishLineReached || input.finishLineReached === true,
    activeRunId: null,
    state: "paused" as const,
  };
  const stop = decidePortfolioHeartbeatStop(completed, input.completedAt);
  if (stop.reason !== "continue") return stop;
  return { accepted: true, state: completed, reason: "continue" };
}

export function buildPortfolioHeartbeatReceipt(input: {
  readonly commandId: PortfolioHeartbeatReceipt["commandId"];
  readonly target: PortfolioTarget;
  readonly status: PortfolioHeartbeatReceiptStatus;
  readonly observedAt: PortfolioHeartbeatReceipt["observedAt"];
  readonly detail: string;
  readonly sequence?: PortfolioHeartbeatReceipt["sequence"];
}): PortfolioHeartbeatReceipt {
  return {
    commandId: input.commandId,
    target: input.target,
    status: input.status,
    observedAt: input.observedAt,
    detail: input.detail.trim() || "Heartbeat receipt has no detail.",
    ...(input.sequence === undefined ? {} : { sequence: input.sequence }),
  };
}
