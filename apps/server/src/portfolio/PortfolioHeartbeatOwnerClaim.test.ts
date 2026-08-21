import { EnvironmentId, ProjectId, ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  decidePortfolioHeartbeatOwnerClaim,
  type PortfolioHeartbeatOwnerClaimInput,
} from "./PortfolioHeartbeatOwnerClaim.ts";

const ownerEnvironmentId = EnvironmentId.make("environment-mac");
const target = {
  environmentId: ownerEnvironmentId,
  projectId: ProjectId.make("project-portfolio"),
  threadId: ThreadId.make("thread-heartbeat"),
};

const input = (
  overrides: Partial<PortfolioHeartbeatOwnerClaimInput> = {},
): PortfolioHeartbeatOwnerClaimInput => ({
  current: null,
  ownerEnvironmentId,
  target,
  portfolioRevision: 1,
  heartbeatRevision: 1,
  portfolioChecksum: "portfolio-sha-1",
  heartbeatChecksum: "heartbeat-sha-1",
  updatedAt: "2026-08-19T06:00:00.000Z",
  ...overrides,
});

describe("PortfolioHeartbeatOwner claim decision", () => {
  it("accepts an initial claim at epoch zero with the canonical target", () => {
    expect(decidePortfolioHeartbeatOwnerClaim(input())).toEqual({
      accepted: true,
      reason: "accepted",
      descriptor: {
        schemaVersion: "1",
        domain: "portfolio_heartbeat",
        ownerEnvironmentId,
        ownerEpoch: 0,
        portfolioRevision: 1,
        heartbeatRevision: 1,
        portfolioChecksum: "portfolio-sha-1",
        heartbeatChecksum: "heartbeat-sha-1",
        updatedAt: "2026-08-19T06:00:00.000Z",
        target,
        lastReceipt: null,
      },
    });
  });

  it("accepts a matching repeat without changing the descriptor", () => {
    const descriptor = decidePortfolioHeartbeatOwnerClaim(input()).descriptor;
    expect(decidePortfolioHeartbeatOwnerClaim(input({ current: descriptor }))).toEqual({
      accepted: true,
      reason: "already-owner",
      descriptor,
    });
  });

  it("refuses a different owner and descriptor drift", () => {
    const descriptor = decidePortfolioHeartbeatOwnerClaim(input()).descriptor;
    expect(
      decidePortfolioHeartbeatOwnerClaim(
        input({
          current: descriptor,
          ownerEnvironmentId: EnvironmentId.make("environment-vps"),
        }),
      ),
    ).toMatchObject({ accepted: false, reason: "different-owner", descriptor: null });
    expect(
      decidePortfolioHeartbeatOwnerClaim(
        input({ current: descriptor, heartbeatChecksum: "different" }),
      ),
    ).toMatchObject({ accepted: false, reason: "descriptor-mismatch", descriptor: null });
  });
});
