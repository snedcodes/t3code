export type HeartbeatOwnerRole = "owner" | "non_owner" | "owner_unavailable";
export type HeartbeatOwnerFreshness = "fresh" | "stale" | "unknown";

export type HeartbeatOwnerDescriptor = {
  readonly schemaVersion: string | null;
  readonly domain: "portfolio_heartbeat" | null;
  readonly ownerHostUuid: string | null;
  readonly ownerHostId: string | null;
  readonly ownerBaseUrl: string | null;
  readonly ownerEpoch: number | null;
  readonly ownerRevision: number | null;
  readonly portfolioLedgerRevision: number | null;
  readonly portfolioChecksum: string | null;
  readonly heartbeatSettingsRevision: number | null;
  readonly heartbeatChecksum: string | null;
  readonly lastTransferReceipt: unknown;
};

export type HeartbeatOwnerState = {
  readonly role: HeartbeatOwnerRole;
  readonly freshness: HeartbeatOwnerFreshness;
  readonly descriptor: HeartbeatOwnerDescriptor | null;
};

const EMPTY_DESCRIPTOR: HeartbeatOwnerDescriptor = {
  schemaVersion: null,
  domain: null,
  ownerHostUuid: null,
  ownerHostId: null,
  ownerBaseUrl: null,
  ownerEpoch: null,
  ownerRevision: null,
  portfolioLedgerRevision: null,
  portfolioChecksum: null,
  heartbeatSettingsRevision: null,
  heartbeatChecksum: null,
  lastTransferReceipt: null,
};

const EMPTY_OWNER_STATE: HeartbeatOwnerState = {
  role: "owner_unavailable",
  freshness: "unknown",
  descriptor: null,
};

function recordValue(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function textValue(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function integerValue(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function descriptorFrom(value: unknown): HeartbeatOwnerDescriptor | null {
  const input = recordValue(value);
  if (!input) return null;

  const hasDescriptorField = [
    "schema_version",
    "domain",
    "owner_host_uuid",
    "owner_host_id",
    "owner_base_url",
    "owner_epoch",
    "owner_revision",
    "portfolio_ledger_revision",
    "portfolio_checksum",
    "heartbeat_settings_revision",
    "heartbeat_checksum",
    "last_transfer_receipt",
  ].some((key) => key in input);
  if (!hasDescriptorField) return null;

  return {
    schemaVersion: textValue(input.schema_version),
    domain: input.domain === "portfolio_heartbeat" ? "portfolio_heartbeat" : null,
    ownerHostUuid: textValue(input.owner_host_uuid),
    ownerHostId: textValue(input.owner_host_id),
    ownerBaseUrl: textValue(input.owner_base_url),
    ownerEpoch: integerValue(input.owner_epoch),
    ownerRevision: integerValue(input.owner_revision),
    portfolioLedgerRevision: integerValue(input.portfolio_ledger_revision),
    portfolioChecksum: textValue(input.portfolio_checksum),
    heartbeatSettingsRevision: integerValue(input.heartbeat_settings_revision),
    heartbeatChecksum: textValue(input.heartbeat_checksum),
    lastTransferReceipt: input.last_transfer_receipt ?? null,
  };
}

/**
 * Normalizes the future owner endpoint without guessing authority from local
 * T3 state. No descriptor means that the VoiceTools owner is unavailable.
 */
export function normalizeHeartbeatOwnerState(value: unknown): HeartbeatOwnerState {
  const input = recordValue(value);
  if (!input) return EMPTY_OWNER_STATE;

  const role: HeartbeatOwnerRole =
    input.role === "owner" || input.role === "non_owner" || input.role === "owner_unavailable"
      ? input.role
      : "owner_unavailable";
  const freshness: HeartbeatOwnerFreshness =
    input.freshness === "fresh" || input.freshness === "stale" || input.freshness === "unknown"
      ? input.freshness
      : "unknown";
  const descriptor = descriptorFrom(input.descriptor ?? input);

  return {
    role,
    freshness,
    descriptor,
  };
}

export function heartbeatOwnerRoleLabel(role: HeartbeatOwnerRole): string {
  switch (role) {
    case "owner":
      return "Owner";
    case "non_owner":
      return "Non-owner";
    case "owner_unavailable":
      return "Not connected";
  }
}

export function heartbeatOwnerDescriptorForTests(): HeartbeatOwnerDescriptor {
  return { ...EMPTY_DESCRIPTOR };
}
