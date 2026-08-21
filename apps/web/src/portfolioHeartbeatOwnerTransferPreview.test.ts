import { describe, expect, it } from "vite-plus/test";
import { buildPortfolioHeartbeatOwnerTransferPreview } from "./portfolioHeartbeatOwnerTransferPreview";

const sourceId = "environment-mac";
const targetId = "environment-vps";

const camelDescriptor = (role: "owner" | "non_owner") => ({
  role,
  descriptor: {
    ownerEnvironmentId: role === "owner" ? sourceId : targetId,
    ownerEpoch: role === "owner" ? 4 : 0,
    portfolioRevision: 12,
    heartbeatRevision: 9,
    portfolioChecksum: "portfolio-sha-12",
    heartbeatChecksum: "heartbeat-sha-9",
    heartbeatsPaused: true,
  },
});

describe("Portfolio Heartbeat owner transfer preview", () => {
  it("normalizes native camel-case descriptors and returns a disabled accepted preview", () => {
    const preview = buildPortfolioHeartbeatOwnerTransferPreview({
      source: camelDescriptor("owner"),
      target: camelDescriptor("non_owner"),
      proposedOwnerEpoch: 5,
    });

    expect(preview).toMatchObject({
      transferEnabled: false,
      reason: "accepted",
      receiptStatus: "accepted",
      oldOwnerRole: "non_owner",
      newOwnerRole: "owner",
      ownerEpoch: 5,
      revisionContinuity: { portfolio: true, heartbeat: true },
      checksumContinuity: { portfolio: true, heartbeat: true },
      source: { environmentId: sourceId, role: "owner", heartbeatsPaused: true },
      target: { environmentId: targetId, role: "non_owner", heartbeatsPaused: true },
    });
  });

  it("normalizes existing snake-case descriptors and exposes continuity failures", () => {
    const preview = buildPortfolioHeartbeatOwnerTransferPreview({
      source: {
        role: "owner",
        owner_environment_id: sourceId,
        owner_epoch: 4,
        portfolio_ledger_revision: 12,
        heartbeat_settings_revision: 9,
        portfolio_checksum: "portfolio-sha-12",
        heartbeat_checksum: "heartbeat-sha-9",
        heartbeats_paused: true,
      },
      target: {
        role: "non_owner",
        owner_environment_id: targetId,
        owner_epoch: 4,
        portfolio_ledger_revision: 13,
        heartbeat_settings_revision: 9,
        portfolio_checksum: "different",
        heartbeat_checksum: "heartbeat-sha-9",
        heartbeats_paused: true,
      },
      proposedOwnerEpoch: 5,
    });

    expect(preview).toMatchObject({
      reason: "revision-mismatch",
      receiptStatus: "failed",
      oldOwnerRole: "owner",
      newOwnerRole: "non_owner",
      revisionContinuity: { portfolio: false, heartbeat: true },
      checksumContinuity: { portfolio: false, heartbeat: true },
    });
  });

  it("fails closed for incomplete descriptors and duplicate existing owners", () => {
    expect(
      buildPortfolioHeartbeatOwnerTransferPreview({
        source: { role: "owner", ownerEnvironmentId: sourceId },
        target: camelDescriptor("non_owner"),
        proposedOwnerEpoch: 5,
      }),
    ).toMatchObject({
      transferEnabled: false,
      reason: "invalid-source",
      receiptStatus: "failed",
      oldOwnerRole: "owner_unavailable",
    });

    expect(
      buildPortfolioHeartbeatOwnerTransferPreview({
        source: camelDescriptor("owner"),
        target: camelDescriptor("non_owner"),
        proposedOwnerEpoch: 5,
        existingOwnerEnvironmentIds: [sourceId, targetId],
      }),
    ).toMatchObject({
      transferEnabled: false,
      reason: "duplicate-owner",
      receiptStatus: "failed",
      oldOwnerRole: "owner",
      newOwnerRole: "non_owner",
    });
  });
});
