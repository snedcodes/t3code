import { describe, expect, it } from "vite-plus/test";
import * as Schema from "effect/Schema";

import {
  PortfolioHeartbeatOwnerDescriptor,
  PortfolioHeartbeatOwnerReadback,
  PortfolioHeartbeatOwnerRole,
  PortfolioHeartbeatFreshness,
  PortfolioHeartbeatReceipt,
  PortfolioHeartbeatReceiptStatus,
  PortfolioTarget,
} from "./portfolio.ts";

const decodeTarget = Schema.decodeUnknownSync(PortfolioTarget);
const decodeReceipt = Schema.decodeUnknownSync(PortfolioHeartbeatReceipt);
const decodeDescriptor = Schema.decodeUnknownSync(PortfolioHeartbeatOwnerDescriptor);
const decodeReadback = Schema.decodeUnknownSync(PortfolioHeartbeatOwnerReadback);

const TARGET = {
  environmentId: "env-mac",
  projectId: "project-portfolio",
  threadId: "thread-heartbeat",
};

const RECEIPT = {
  commandId: "command-heartbeat-1",
  target: TARGET,
  status: "transcript-confirmed",
  sequence: 42,
  observedAt: "2026-08-19T12:00:00.000Z",
  detail: "Transcript confirmation observed",
};

describe("Portfolio heartbeat contracts", () => {
  it("decodes and brands the canonical native T3 target", () => {
    const target = decodeTarget({
      environmentId: "  env-mac  ",
      projectId: "project-portfolio",
      threadId: "thread-heartbeat",
    });

    expect(target).toEqual(TARGET);
  });

  it("decodes receipts with and without an optional dispatch sequence", () => {
    expect(decodeReceipt(RECEIPT)).toMatchObject(RECEIPT);
    expect(
      decodeReceipt({
        commandId: "command-heartbeat-2",
        target: TARGET,
        status: "accepted",
        observedAt: "2026-08-19T12:01:00.000Z",
        detail: "Accepted by target environment",
      }).sequence,
    ).toBeUndefined();
  });

  it("decodes an owner descriptor and nullable target/receipt", () => {
    const descriptor = decodeDescriptor({
      schemaVersion: "portfolio_heartbeat_owner.v1",
      domain: "portfolio_heartbeat",
      ownerEnvironmentId: "env-mac",
      ownerEpoch: 2,
      portfolioRevision: 11,
      heartbeatRevision: 13,
      portfolioChecksum: "portfolio-sha",
      heartbeatChecksum: "heartbeat-sha",
      updatedAt: "2026-08-19T12:02:00.000Z",
      target: null,
      lastReceipt: null,
    });

    expect(descriptor).toMatchObject({
      domain: "portfolio_heartbeat",
      ownerEnvironmentId: "env-mac",
      ownerEpoch: 2,
      target: null,
      lastReceipt: null,
    });
  });

  it("decodes owner readback roles and freshness", () => {
    const readback = decodeReadback({
      role: "owner",
      freshness: "fresh",
      descriptor: {
        schemaVersion: "portfolio_heartbeat_owner.v1",
        domain: "portfolio_heartbeat",
        ownerEnvironmentId: "env-mac",
        ownerEpoch: 2,
        portfolioRevision: 11,
        heartbeatRevision: 13,
        portfolioChecksum: "portfolio-sha",
        heartbeatChecksum: "heartbeat-sha",
        updatedAt: "2026-08-19T12:02:00.000Z",
        target: TARGET,
        lastReceipt: RECEIPT,
      },
    });

    expect(readback.role).toBe("owner");
    expect(readback.freshness).toBe("fresh");
    expect(readback.descriptor?.target).toEqual(TARGET);
    expect(readback.descriptor?.lastReceipt?.status).toBe("transcript-confirmed");
  });

  it("rejects values outside the typed role, freshness, and receipt status sets", () => {
    expect(() => Schema.decodeUnknownSync(PortfolioHeartbeatOwnerRole)("primary")).toThrow();
    expect(() => Schema.decodeUnknownSync(PortfolioHeartbeatFreshness)("current")).toThrow();
    expect(() => Schema.decodeUnknownSync(PortfolioHeartbeatReceiptStatus)("complete")).toThrow();
    expect(() =>
      decodeReadback({ role: "owner", freshness: "fresh", descriptor: null }),
    ).not.toThrow();
  });
});
