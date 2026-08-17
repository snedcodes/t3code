import { describe, expect, it } from "vite-plus/test";
import { heartbeatOwnerRoleLabel, normalizeHeartbeatOwnerState } from "./portfolioHeartbeatOwner";

describe("normalizeHeartbeatOwnerState", () => {
  it("does not invent a local owner when VoiceTools is not connected", () => {
    expect(normalizeHeartbeatOwnerState(null)).toEqual({
      role: "owner_unavailable",
      freshness: "unknown",
      descriptor: null,
    });
  });

  it("keeps explicit owner and checksum metadata from the future contract", () => {
    expect(
      normalizeHeartbeatOwnerState({
        role: "owner",
        freshness: "fresh",
        descriptor: {
          schema_version: "portfolio_heartbeat_owner.v1",
          domain: "portfolio_heartbeat",
          owner_host_uuid: "mac-owner",
          owner_epoch: 2,
          owner_revision: 7,
          portfolio_ledger_revision: 11,
          portfolio_checksum: "portfolio-sha",
          heartbeat_settings_revision: 13,
          heartbeat_checksum: "heartbeat-sha",
        },
      }),
    ).toMatchObject({
      role: "owner",
      freshness: "fresh",
      descriptor: {
        schemaVersion: "portfolio_heartbeat_owner.v1",
        domain: "portfolio_heartbeat",
        ownerHostUuid: "mac-owner",
        ownerEpoch: 2,
        ownerRevision: 7,
        portfolioLedgerRevision: 11,
        heartbeatSettingsRevision: 13,
      },
    });
  });

  it("does not infer authority from incomplete or invalid input", () => {
    expect(normalizeHeartbeatOwnerState({ owner_host_uuid: "unknown" })).toMatchObject({
      role: "owner_unavailable",
      freshness: "unknown",
      descriptor: { ownerHostUuid: "unknown" },
    });
    expect(normalizeHeartbeatOwnerState({ role: "owner", descriptor: {} })).toMatchObject({
      role: "owner",
      descriptor: null,
    });
  });
});

describe("heartbeatOwnerRoleLabel", () => {
  it("uses clear operator-facing labels", () => {
    expect(heartbeatOwnerRoleLabel("owner")).toBe("Owner");
    expect(heartbeatOwnerRoleLabel("non_owner")).toBe("Non-owner");
    expect(heartbeatOwnerRoleLabel("owner_unavailable")).toBe("Not connected");
  });
});
