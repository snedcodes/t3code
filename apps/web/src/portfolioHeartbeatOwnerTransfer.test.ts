import { EnvironmentId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";
import {
  buildPortfolioHeartbeatOwnerTransferReceipt,
  decidePortfolioHeartbeatOwnerTransfer,
  PORTFOLIO_HEARTBEAT_OWNER_TRANSFER_RECEIPT_STATUSES,
  type PortfolioHeartbeatOwnerTransferParticipant,
} from "./portfolioHeartbeatOwnerTransfer";

const sourceEnvironmentId = EnvironmentId.make("environment-mac");
const targetEnvironmentId = EnvironmentId.make("environment-vps");

const participant = (
  environmentId: typeof sourceEnvironmentId,
  role: PortfolioHeartbeatOwnerTransferParticipant["role"],
  overrides: Partial<PortfolioHeartbeatOwnerTransferParticipant> = {},
): PortfolioHeartbeatOwnerTransferParticipant => ({
  environmentId,
  role,
  heartbeatsPaused: true,
  ownerEpoch: 4,
  portfolioRevision: 12,
  heartbeatRevision: 9,
  portfolioChecksum: "portfolio-sha-12",
  heartbeatChecksum: "heartbeat-sha-9",
  ...overrides,
});

const transfer = (
  overrides: Partial<Parameters<typeof decidePortfolioHeartbeatOwnerTransfer>[0]> = {},
) =>
  decidePortfolioHeartbeatOwnerTransfer({
    source: participant(sourceEnvironmentId, "owner"),
    target: participant(targetEnvironmentId, "non_owner", { ownerEpoch: 0 }),
    proposedOwnerEpoch: 5,
    existingOwnerEnvironmentIds: [sourceEnvironmentId],
    ...overrides,
  });

describe("Portfolio Heartbeat owner transfer", () => {
  it("accepts a paused transfer with a strictly newer epoch and continuous snapshot", () => {
    expect(transfer()).toEqual({
      accepted: true,
      reason: "accepted",
      ownerEpoch: 5,
      oldOwner: { environmentId: sourceEnvironmentId, role: "non_owner" },
      newOwner: { environmentId: targetEnvironmentId, role: "owner" },
      portfolioRevision: 12,
      heartbeatRevision: 9,
      portfolioChecksum: "portfolio-sha-12",
      heartbeatChecksum: "heartbeat-sha-9",
    });
  });

  it("requires both participants to be paused before transfer", () => {
    expect(
      transfer({
        source: participant(sourceEnvironmentId, "owner", { heartbeatsPaused: false }),
      }),
    ).toMatchObject({ accepted: false, reason: "heartbeats-not-paused" });
    expect(
      transfer({
        target: participant(targetEnvironmentId, "non_owner", { heartbeatsPaused: false }),
      }),
    ).toMatchObject({ accepted: false, reason: "heartbeats-not-paused" });
  });

  it("rejects stale epochs, revision/checksum drift, and duplicate owners", () => {
    expect(transfer({ proposedOwnerEpoch: 4 })).toMatchObject({
      accepted: false,
      reason: "epoch-not-monotonic",
    });
    expect(
      transfer({
        target: participant(targetEnvironmentId, "non_owner", { portfolioRevision: 13 }),
      }),
    ).toMatchObject({ accepted: false, reason: "revision-mismatch" });
    expect(
      transfer({
        target: participant(targetEnvironmentId, "non_owner", {
          heartbeatChecksum: "different",
        }),
      }),
    ).toMatchObject({ accepted: false, reason: "checksum-mismatch" });
    expect(
      transfer({ existingOwnerEnvironmentIds: [sourceEnvironmentId, targetEnvironmentId] }),
    ).toMatchObject({ accepted: false, reason: "duplicate-owner" });
    expect(
      transfer({
        target: participant(targetEnvironmentId, "owner", { ownerEpoch: 0 }),
      }),
    ).toMatchObject({ accepted: false, reason: "duplicate-owner" });
  });

  it("preserves old/new roles and rejects unavailable or non-owner participants", () => {
    expect(
      transfer({
        source: participant(sourceEnvironmentId, "non_owner"),
      }),
    ).toMatchObject({
      accepted: false,
      reason: "source-not-owner",
      oldOwner: { role: "non_owner" },
      newOwner: { role: "non_owner" },
    });
    expect(
      transfer({
        target: participant(targetEnvironmentId, "owner_unavailable", { ownerEpoch: 0 }),
      }),
    ).toMatchObject({
      accepted: false,
      reason: "target-unavailable",
      newOwner: { role: "owner_unavailable" },
    });
  });

  it("builds receipts for every existing contract status", () => {
    const receipts = PORTFOLIO_HEARTBEAT_OWNER_TRANSFER_RECEIPT_STATUSES.map((status) =>
      buildPortfolioHeartbeatOwnerTransferReceipt({
        status,
        sourceOwnerEnvironmentId: sourceEnvironmentId,
        targetOwnerEnvironmentId: targetEnvironmentId,
        ownerEpoch: 5,
        portfolioRevision: 12,
        heartbeatRevision: 9,
        portfolioChecksum: "portfolio-sha-12",
        heartbeatChecksum: "heartbeat-sha-9",
        observedAt: "2026-08-19T00:00:00.000Z",
        detail: ` ${status} `,
      }),
    );

    expect(receipts.map((receipt) => receipt.status)).toEqual(
      PORTFOLIO_HEARTBEAT_OWNER_TRANSFER_RECEIPT_STATUSES,
    );
    expect(receipts[0]).toMatchObject({
      sourceOwnerEnvironmentId: sourceEnvironmentId,
      targetOwnerEnvironmentId: targetEnvironmentId,
      detail: "accepted",
    });
  });
});
