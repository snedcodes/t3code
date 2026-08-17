import type { NativeHeartbeatTarget } from "./portfolioHeartbeatTargets";

export type PausedNativeHeartbeatDraft = {
  readonly target: Pick<NativeHeartbeatTarget, "environmentId" | "projectId" | "threadId">;
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
 * thread IDs are the only identity carried forward; all VoiceTools-owned
 * configuration remains unavailable until an owner adapter exists.
 */
export function buildPausedNativeHeartbeatDraft(
  target: NativeHeartbeatTarget,
): PausedNativeHeartbeatDraft {
  return {
    target: {
      environmentId: target.environmentId,
      projectId: target.projectId,
      threadId: target.threadId,
    },
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
    receiptOwner: "VoiceTools Portfolio/Heartbeat owner (not connected)",
  };
}
