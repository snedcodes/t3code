import type {
  PortfolioHeartbeatOwnerRole,
  PortfolioHeartbeatReceiptStatus,
} from "@t3tools/contracts";
import type { EnvironmentId } from "@t3tools/contracts";

export const PORTFOLIO_HEARTBEAT_OWNER_TRANSFER_RECEIPT_STATUSES = [
  "accepted",
  "dispatched",
  "transcript-confirmed",
  "confirmation-delayed",
  "uncertain",
  "failed",
] as const satisfies ReadonlyArray<PortfolioHeartbeatReceiptStatus>;

export type PortfolioHeartbeatOwnerTransferParticipant = {
  readonly environmentId: EnvironmentId;
  readonly role: PortfolioHeartbeatOwnerRole;
  readonly heartbeatsPaused: boolean;
  readonly ownerEpoch: number;
  readonly portfolioRevision: number;
  readonly heartbeatRevision: number;
  readonly portfolioChecksum: string;
  readonly heartbeatChecksum: string;
};

export type PortfolioHeartbeatOwnerTransferReason =
  | "accepted"
  | "source-not-owner"
  | "target-unavailable"
  | "duplicate-owner"
  | "heartbeats-not-paused"
  | "epoch-not-monotonic"
  | "revision-mismatch"
  | "checksum-mismatch";

export type PortfolioHeartbeatOwnerTransferDecision = {
  readonly accepted: boolean;
  readonly reason: PortfolioHeartbeatOwnerTransferReason;
  readonly ownerEpoch: number;
  readonly oldOwner: {
    readonly environmentId: EnvironmentId;
    readonly role: PortfolioHeartbeatOwnerRole;
  };
  readonly newOwner: {
    readonly environmentId: EnvironmentId;
    readonly role: PortfolioHeartbeatOwnerRole;
  };
  readonly portfolioRevision: number;
  readonly heartbeatRevision: number;
  readonly portfolioChecksum: string;
  readonly heartbeatChecksum: string;
};

export type PortfolioHeartbeatOwnerTransferReceipt = {
  readonly status: PortfolioHeartbeatReceiptStatus;
  readonly sourceOwnerEnvironmentId: EnvironmentId;
  readonly targetOwnerEnvironmentId: EnvironmentId;
  readonly ownerEpoch: number;
  readonly portfolioRevision: number;
  readonly heartbeatRevision: number;
  readonly portfolioChecksum: string;
  readonly heartbeatChecksum: string;
  readonly observedAt: string;
  readonly detail: string;
};

function decision(
  source: PortfolioHeartbeatOwnerTransferParticipant,
  target: PortfolioHeartbeatOwnerTransferParticipant,
  ownerEpoch: number,
  reason: PortfolioHeartbeatOwnerTransferReason,
  accepted: boolean,
): PortfolioHeartbeatOwnerTransferDecision {
  return {
    accepted,
    reason,
    ownerEpoch,
    oldOwner: {
      environmentId: source.environmentId,
      role: accepted ? "non_owner" : source.role,
    },
    newOwner: {
      environmentId: target.environmentId,
      role: accepted ? "owner" : target.role,
    },
    portfolioRevision: source.portfolioRevision,
    heartbeatRevision: source.heartbeatRevision,
    portfolioChecksum: source.portfolioChecksum,
    heartbeatChecksum: source.heartbeatChecksum,
  };
}

/**
 * Decides whether a staged owner transfer is safe to accept. This compares
 * descriptors only; it never writes an owner file, changes a role, or pauses
 * a live Heartbeat.
 */
export function decidePortfolioHeartbeatOwnerTransfer(input: {
  readonly source: PortfolioHeartbeatOwnerTransferParticipant;
  readonly target: PortfolioHeartbeatOwnerTransferParticipant;
  readonly proposedOwnerEpoch: number;
  readonly existingOwnerEnvironmentIds: ReadonlyArray<EnvironmentId>;
}): PortfolioHeartbeatOwnerTransferDecision {
  const { source, target } = input;
  if (source.environmentId === target.environmentId) {
    return decision(source, target, input.proposedOwnerEpoch, "duplicate-owner", false);
  }
  if (source.role !== "owner") {
    return decision(source, target, input.proposedOwnerEpoch, "source-not-owner", false);
  }
  if (target.role === "owner" || target.role === "owner_unavailable") {
    return decision(
      source,
      target,
      input.proposedOwnerEpoch,
      target.role === "owner" ? "duplicate-owner" : "target-unavailable",
      false,
    );
  }

  const existingOwners = input.existingOwnerEnvironmentIds;
  if (
    existingOwners.length !== 1 ||
    existingOwners[0] !== source.environmentId ||
    existingOwners.includes(target.environmentId)
  ) {
    return decision(source, target, input.proposedOwnerEpoch, "duplicate-owner", false);
  }
  if (!source.heartbeatsPaused || !target.heartbeatsPaused) {
    return decision(source, target, input.proposedOwnerEpoch, "heartbeats-not-paused", false);
  }
  if (
    input.proposedOwnerEpoch <= Math.max(source.ownerEpoch, target.ownerEpoch) ||
    !Number.isSafeInteger(input.proposedOwnerEpoch) ||
    input.proposedOwnerEpoch < 0
  ) {
    return decision(source, target, input.proposedOwnerEpoch, "epoch-not-monotonic", false);
  }
  if (
    source.portfolioRevision !== target.portfolioRevision ||
    source.heartbeatRevision !== target.heartbeatRevision
  ) {
    return decision(source, target, input.proposedOwnerEpoch, "revision-mismatch", false);
  }
  if (
    source.portfolioChecksum !== target.portfolioChecksum ||
    source.heartbeatChecksum !== target.heartbeatChecksum
  ) {
    return decision(source, target, input.proposedOwnerEpoch, "checksum-mismatch", false);
  }

  return decision(source, target, input.proposedOwnerEpoch, "accepted", true);
}

export function buildPortfolioHeartbeatOwnerTransferReceipt(input: {
  readonly status: PortfolioHeartbeatReceiptStatus;
  readonly sourceOwnerEnvironmentId: EnvironmentId;
  readonly targetOwnerEnvironmentId: EnvironmentId;
  readonly ownerEpoch: number;
  readonly portfolioRevision: number;
  readonly heartbeatRevision: number;
  readonly portfolioChecksum: string;
  readonly heartbeatChecksum: string;
  readonly observedAt: string;
  readonly detail: string;
}): PortfolioHeartbeatOwnerTransferReceipt {
  return {
    ...input,
    detail: input.detail.trim() || "Owner transfer receipt has no detail.",
  };
}
