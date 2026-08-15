import type { ScopedThreadRef } from "@t3tools/contracts";

export const NATIVE_HEARTBEAT_ALLOWED_ACTION = "send-normal-t3-turn" as const;
export const NATIVE_HEARTBEAT_RECEIPT_OWNER = "native-t3-orchestration" as const;

export type NativeHeartbeatStatus = "paused" | "running" | "completed" | "expired";

export interface NativeHeartbeatDefinition {
  readonly heartbeatId: string;
  readonly status: NativeHeartbeatStatus;
  /** A native scoped ref only; no copied Passport or session-key identity. */
  readonly targetThread: ScopedThreadRef | null;
  readonly cadenceMinutes: number;
  readonly maxRuns: number;
  readonly expiresAt: string | null;
  readonly finishLine: string;
  readonly allowedActions: ReadonlyArray<typeof NATIVE_HEARTBEAT_ALLOWED_ACTION>;
  readonly stopConditions: ReadonlyArray<string>;
  readonly receiptOwner: typeof NATIVE_HEARTBEAT_RECEIPT_OWNER;
}

export interface NativeHeartbeatValidation {
  readonly valid: boolean;
  readonly errors: ReadonlyArray<string>;
}

export function createPausedNativeHeartbeat(
  targetThread: ScopedThreadRef | null = null,
): NativeHeartbeatDefinition {
  return {
    heartbeatId: "draft-native-t3-heartbeat",
    status: "paused",
    targetThread,
    cadenceMinutes: 15,
    maxRuns: 1,
    expiresAt: null,
    finishLine: "A bounded finish line must be supplied before activation.",
    allowedActions: [NATIVE_HEARTBEAT_ALLOWED_ACTION],
    stopConditions: [
      "Finish line is recorded as complete.",
      "Expiry is reached.",
      "A normal T3 turn returns an error or requires user approval.",
    ],
    receiptOwner: NATIVE_HEARTBEAT_RECEIPT_OWNER,
  };
}

export function validateNativeHeartbeat(
  definition: NativeHeartbeatDefinition,
): NativeHeartbeatValidation {
  const errors: string[] = [];
  if (definition.cadenceMinutes <= 0) errors.push("Cadence must be greater than zero.");
  if (definition.maxRuns <= 0) errors.push("Run limit must be greater than zero.");
  if (definition.finishLine.trim().length === 0) errors.push("A finish line is required.");
  if (
    definition.allowedActions.length !== 1 ||
    definition.allowedActions[0] !== NATIVE_HEARTBEAT_ALLOWED_ACTION
  ) {
    errors.push("Only normal native T3 turns are allowed.");
  }
  if (definition.stopConditions.length === 0)
    errors.push("At least one stop condition is required.");
  if (definition.receiptOwner !== NATIVE_HEARTBEAT_RECEIPT_OWNER) {
    errors.push("Receipts must remain owned by native T3 orchestration.");
  }
  return { valid: errors.length === 0, errors };
}
