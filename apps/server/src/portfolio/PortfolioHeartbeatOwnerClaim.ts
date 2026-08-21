import type {
  EnvironmentId,
  PortfolioHeartbeatOwnerDescriptor,
  PortfolioTarget,
} from "@t3tools/contracts";

export type PortfolioHeartbeatOwnerClaimInput = {
  readonly current: PortfolioHeartbeatOwnerDescriptor | null;
  readonly ownerEnvironmentId: EnvironmentId;
  readonly target: PortfolioTarget;
  readonly portfolioRevision: number;
  readonly heartbeatRevision: number;
  readonly portfolioChecksum: string;
  readonly heartbeatChecksum: string;
  readonly updatedAt: string;
};

export type PortfolioHeartbeatOwnerClaimReason =
  | "accepted"
  | "already-owner"
  | "different-owner"
  | "descriptor-mismatch";

export type PortfolioHeartbeatOwnerClaimDecision = {
  readonly accepted: boolean;
  readonly reason: PortfolioHeartbeatOwnerClaimReason;
  readonly descriptor: PortfolioHeartbeatOwnerDescriptor | null;
};

function sameTarget(left: PortfolioTarget, right: PortfolioTarget): boolean {
  return (
    left.environmentId === right.environmentId &&
    left.projectId === right.projectId &&
    left.threadId === right.threadId
  );
}

function descriptorMatchesInput(
  descriptor: PortfolioHeartbeatOwnerDescriptor,
  input: PortfolioHeartbeatOwnerClaimInput,
): boolean {
  return (
    descriptor.ownerEnvironmentId === input.ownerEnvironmentId &&
    descriptor.portfolioRevision === input.portfolioRevision &&
    descriptor.heartbeatRevision === input.heartbeatRevision &&
    descriptor.portfolioChecksum === input.portfolioChecksum &&
    descriptor.heartbeatChecksum === input.heartbeatChecksum &&
    descriptor.target !== null &&
    sameTarget(descriptor.target, input.target)
  );
}

/**
 * Decides an explicit owner claim without writing state. A first claim starts
 * at epoch zero; a matching repeated claim is idempotent; a competing owner or
 * descriptor drift is rejected so two schedulers cannot be created silently.
 */
export function decidePortfolioHeartbeatOwnerClaim(
  input: PortfolioHeartbeatOwnerClaimInput,
): PortfolioHeartbeatOwnerClaimDecision {
  const current = input.current;
  if (current !== null) {
    if (current.ownerEnvironmentId !== input.ownerEnvironmentId) {
      return { accepted: false, reason: "different-owner", descriptor: null };
    }
    if (descriptorMatchesInput(current, input)) {
      return { accepted: true, reason: "already-owner", descriptor: current };
    }
    return { accepted: false, reason: "descriptor-mismatch", descriptor: null };
  }

  return {
    accepted: true,
    reason: "accepted",
    descriptor: {
      schemaVersion: "1",
      domain: "portfolio_heartbeat",
      ownerEnvironmentId: input.ownerEnvironmentId,
      ownerEpoch: 0,
      portfolioRevision: input.portfolioRevision,
      heartbeatRevision: input.heartbeatRevision,
      portfolioChecksum: input.portfolioChecksum,
      heartbeatChecksum: input.heartbeatChecksum,
      updatedAt: input.updatedAt,
      target: input.target,
      lastReceipt: null,
    },
  };
}
