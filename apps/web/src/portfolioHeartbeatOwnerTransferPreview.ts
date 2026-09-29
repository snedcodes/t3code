import { EnvironmentId } from "@t3tools/contracts";
import type {
  PortfolioHeartbeatOwnerRole,
  PortfolioHeartbeatReceiptStatus,
} from "@t3tools/contracts";
import {
  decidePortfolioHeartbeatOwnerTransfer,
  type PortfolioHeartbeatOwnerTransferDecision,
  type PortfolioHeartbeatOwnerTransferParticipant,
  type PortfolioHeartbeatOwnerTransferReason,
} from "./portfolioHeartbeatOwnerTransfer";

type OwnerTransferInput = Record<string, unknown>;

export type PortfolioHeartbeatOwnerTransferPreview = {
  readonly transferEnabled: false;
  readonly source: PortfolioHeartbeatOwnerTransferParticipant | null;
  readonly target: PortfolioHeartbeatOwnerTransferParticipant | null;
  readonly decision: PortfolioHeartbeatOwnerTransferDecision | null;
  readonly reason: PortfolioHeartbeatOwnerTransferReason | "invalid-source" | "invalid-target";
  readonly oldOwnerRole: PortfolioHeartbeatOwnerRole;
  readonly newOwnerRole: PortfolioHeartbeatOwnerRole;
  readonly ownerEpoch: number | null;
  readonly revisionContinuity: {
    readonly portfolio: boolean | null;
    readonly heartbeat: boolean | null;
  };
  readonly checksumContinuity: {
    readonly portfolio: boolean | null;
    readonly heartbeat: boolean | null;
  };
  readonly receiptStatus: PortfolioHeartbeatReceiptStatus;
  readonly receiptDetail: string;
};

function recordValue(value: unknown): OwnerTransferInput | null {
  return typeof value === "object" && value !== null ? (value as OwnerTransferInput) : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function integerValue(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function valueFrom(input: OwnerTransferInput, keys: ReadonlyArray<string>): unknown {
  for (const key of keys) {
    if (key in input) return input[key];
  }
  return undefined;
}

function roleValue(value: unknown): PortfolioHeartbeatOwnerRole {
  return value === "owner" || value === "non_owner" || value === "owner_unavailable"
    ? value
    : "owner_unavailable";
}

function normalizeParticipant(value: unknown): PortfolioHeartbeatOwnerTransferParticipant | null {
  const outer = recordValue(value);
  if (!outer) return null;
  const descriptor = recordValue(outer.descriptor);
  const input = descriptor ? { ...descriptor, ...outer } : outer;
  const environmentId = stringValue(
    valueFrom(input, [
      "environmentId",
      "environment_id",
      "ownerEnvironmentId",
      "owner_environment_id",
      "ownerHostId",
      "owner_host_id",
    ]),
  );
  const ownerEpoch = integerValue(valueFrom(input, ["ownerEpoch", "owner_epoch"]));
  const portfolioRevision = integerValue(
    valueFrom(input, ["portfolioRevision", "portfolio_revision", "portfolio_ledger_revision"]),
  );
  const heartbeatRevision = integerValue(
    valueFrom(input, ["heartbeatRevision", "heartbeat_revision", "heartbeat_settings_revision"]),
  );
  const portfolioChecksum = stringValue(
    valueFrom(input, ["portfolioChecksum", "portfolio_checksum"]),
  );
  const heartbeatChecksum = stringValue(
    valueFrom(input, ["heartbeatChecksum", "heartbeat_checksum"]),
  );

  if (
    environmentId === null ||
    ownerEpoch === null ||
    portfolioRevision === null ||
    heartbeatRevision === null ||
    portfolioChecksum === null ||
    heartbeatChecksum === null
  ) {
    return null;
  }

  const role = roleValue(valueFrom(input, ["role", "ownerRole", "owner_role"]));
  const paused = valueFrom(input, [
    "heartbeatsPaused",
    "heartbeats_paused",
    "heartbeatPaused",
    "heartbeat_paused",
    "paused",
  ]);

  return {
    environmentId: EnvironmentId.make(environmentId),
    role,
    heartbeatsPaused: paused === true,
    ownerEpoch,
    portfolioRevision,
    heartbeatRevision,
    portfolioChecksum,
    heartbeatChecksum,
  };
}

function continuity(
  source: PortfolioHeartbeatOwnerTransferParticipant | null,
  target: PortfolioHeartbeatOwnerTransferParticipant | null,
): {
  readonly portfolio: boolean | null;
  readonly heartbeat: boolean | null;
} {
  if (!source || !target) return { portfolio: null, heartbeat: null };
  return {
    portfolio: source.portfolioRevision === target.portfolioRevision,
    heartbeat: source.heartbeatRevision === target.heartbeatRevision,
  };
}

function checksumContinuityFor(
  source: PortfolioHeartbeatOwnerTransferParticipant | null,
  target: PortfolioHeartbeatOwnerTransferParticipant | null,
): {
  readonly portfolio: boolean | null;
  readonly heartbeat: boolean | null;
} {
  if (!source || !target) return { portfolio: null, heartbeat: null };
  return {
    portfolio: source.portfolioChecksum === target.portfolioChecksum,
    heartbeat: source.heartbeatChecksum === target.heartbeatChecksum,
  };
}

/**
 * Normalizes old/native owner readback shapes and computes a disabled preview.
 * This function only compares values and never changes owner authority.
 */
export function buildPortfolioHeartbeatOwnerTransferPreview(input: {
  readonly source: unknown;
  readonly target: unknown;
  readonly proposedOwnerEpoch: number;
  readonly existingOwnerEnvironmentIds?: ReadonlyArray<string>;
}): PortfolioHeartbeatOwnerTransferPreview {
  const source = normalizeParticipant(input.source);
  const target = normalizeParticipant(input.target);
  const oldOwnerRole = source?.role ?? "owner_unavailable";
  const newOwnerRole = target?.role ?? "owner_unavailable";
  const revisionContinuity = continuity(source, target);
  const checksumContinuity = checksumContinuityFor(source, target);

  if (!source) {
    return {
      transferEnabled: false,
      source,
      target,
      decision: null,
      reason: "invalid-source",
      oldOwnerRole,
      newOwnerRole,
      ownerEpoch: null,
      revisionContinuity,
      checksumContinuity,
      receiptStatus: "failed",
      receiptDetail: "Source owner descriptor is incomplete or invalid.",
    };
  }
  if (!target) {
    return {
      transferEnabled: false,
      source,
      target,
      decision: null,
      reason: "invalid-target",
      oldOwnerRole,
      newOwnerRole,
      ownerEpoch: input.proposedOwnerEpoch,
      revisionContinuity,
      checksumContinuity,
      receiptStatus: "failed",
      receiptDetail: "Target owner descriptor is incomplete or invalid.",
    };
  }

  const existingOwnerEnvironmentIds = (
    input.existingOwnerEnvironmentIds ?? [String(source.environmentId)]
  ).map((environmentId) => EnvironmentId.make(environmentId));
  const decision = decidePortfolioHeartbeatOwnerTransfer({
    source,
    target,
    proposedOwnerEpoch: input.proposedOwnerEpoch,
    existingOwnerEnvironmentIds,
  });
  return {
    transferEnabled: false,
    source,
    target,
    decision,
    reason: decision.reason,
    oldOwnerRole: decision.oldOwner.role,
    newOwnerRole: decision.newOwner.role,
    ownerEpoch: decision.ownerEpoch,
    revisionContinuity,
    checksumContinuity,
    receiptStatus: decision.accepted ? "accepted" : "failed",
    receiptDetail: decision.accepted
      ? "Transfer preview accepted; live transfer remains disabled."
      : `Transfer preview rejected: ${decision.reason}.`,
  };
}
