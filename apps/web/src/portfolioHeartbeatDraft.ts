import type { NativeHeartbeatTarget } from "./portfolioHeartbeatTargets";
import {
  createPausedPortfolioHeartbeatLifecycle,
  type PortfolioHeartbeatLifecycle,
} from "./portfolioHeartbeatLifecycle";

export type PausedNativeHeartbeatDraft = {
  readonly target: Pick<NativeHeartbeatTarget, "environmentId" | "projectId" | "threadId">;
  readonly lifecycle: PortfolioHeartbeatLifecycle;
  readonly status: "paused";
  readonly cadenceMinutes: number | null;
  readonly maxRuns: number | null;
  readonly expiresAt: string | null;
  readonly finishLine: string | null;
  readonly allowedActions: ReadonlyArray<string>;
  readonly stopConditions: ReadonlyArray<string>;
  readonly receiptOwner: string;
};

/**
 * Creates the non-persistent T3-side draft for a native target. The native
 * thread IDs are the only identity carried forward; no Heartbeat scheduler or
 * persisted owner configuration is activated by this draft.
 */
export function buildPausedNativeHeartbeatDraft(
  target: NativeHeartbeatTarget,
): PausedNativeHeartbeatDraft {
  const targetIdentity = {
    environmentId: target.environmentId,
    projectId: target.projectId,
    threadId: target.threadId,
  } as const;
  return {
    target: targetIdentity,
    lifecycle: createPausedPortfolioHeartbeatLifecycle({ target: targetIdentity }),
    status: "paused",
    cadenceMinutes: null,
    maxRuns: null,
    expiresAt: null,
    finishLine: null,
    allowedActions: [],
    stopConditions: [
      "Maximum runs exhausted",
      "Expiry reached",
      "Goal or finish line reached",
      "Manual pause or stop",
    ],
    receiptOwner: "Native T3 Portfolio owner readback (paused)",
  };
}
