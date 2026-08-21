import * as Schema from "effect/Schema";

import {
  CommandId,
  EnvironmentId,
  IsoDateTime,
  NonNegativeInt,
  ProjectId,
  ThreadId,
  TrimmedNonEmptyString,
} from "./baseSchemas.ts";

/** The one native T3 execution target identified by Portfolio. */
export const PortfolioTarget = Schema.Struct({
  environmentId: EnvironmentId,
  projectId: ProjectId,
  threadId: ThreadId,
});
export type PortfolioTarget = typeof PortfolioTarget.Type;

export const PortfolioHeartbeatOwnerRole = Schema.Literals([
  "owner",
  "non_owner",
  "owner_unavailable",
]);
export type PortfolioHeartbeatOwnerRole = typeof PortfolioHeartbeatOwnerRole.Type;

export const PortfolioHeartbeatFreshness = Schema.Literals(["fresh", "stale", "unknown"]);
export type PortfolioHeartbeatFreshness = typeof PortfolioHeartbeatFreshness.Type;

export const PortfolioHeartbeatReceiptStatus = Schema.Literals([
  "accepted",
  "dispatched",
  "transcript-confirmed",
  "confirmation-delayed",
  "uncertain",
  "failed",
]);
export type PortfolioHeartbeatReceiptStatus = typeof PortfolioHeartbeatReceiptStatus.Type;

export const PortfolioHeartbeatReceipt = Schema.Struct({
  commandId: CommandId,
  target: PortfolioTarget,
  status: PortfolioHeartbeatReceiptStatus,
  sequence: Schema.optionalKey(NonNegativeInt),
  observedAt: IsoDateTime,
  detail: TrimmedNonEmptyString,
});
export type PortfolioHeartbeatReceipt = typeof PortfolioHeartbeatReceipt.Type;

/** Payload used by the current owner to persist the latest native receipt. */
export const PortfolioHeartbeatReceiptRecordRequest = PortfolioHeartbeatReceipt;
export type PortfolioHeartbeatReceiptRecordRequest = PortfolioHeartbeatReceipt;

export const PortfolioHeartbeatOwnerDescriptor = Schema.Struct({
  schemaVersion: TrimmedNonEmptyString,
  domain: Schema.Literal("portfolio_heartbeat"),
  ownerEnvironmentId: EnvironmentId,
  ownerEpoch: NonNegativeInt,
  portfolioRevision: NonNegativeInt,
  heartbeatRevision: NonNegativeInt,
  portfolioChecksum: TrimmedNonEmptyString,
  heartbeatChecksum: TrimmedNonEmptyString,
  updatedAt: IsoDateTime,
  target: Schema.NullOr(PortfolioTarget),
  lastReceipt: Schema.NullOr(PortfolioHeartbeatReceipt),
});
export type PortfolioHeartbeatOwnerDescriptor = typeof PortfolioHeartbeatOwnerDescriptor.Type;

export const PortfolioHeartbeatOwnerReadback = Schema.Struct({
  role: PortfolioHeartbeatOwnerRole,
  freshness: PortfolioHeartbeatFreshness,
  descriptor: Schema.NullOr(PortfolioHeartbeatOwnerDescriptor),
});
export type PortfolioHeartbeatOwnerReadback = typeof PortfolioHeartbeatOwnerReadback.Type;

export const PortfolioHeartbeatLifecycleState = Schema.Literals([
  "paused",
  "active",
  "stopped",
  "expired",
  "finished",
]);
export type PortfolioHeartbeatLifecycleState = typeof PortfolioHeartbeatLifecycleState.Type;

/** Read-only owner-backed Heartbeat configuration; execution remains separate. */
export const PortfolioHeartbeatRecord = Schema.Struct({
  heartbeatId: TrimmedNonEmptyString,
  target: PortfolioTarget,
  status: PortfolioHeartbeatLifecycleState,
  cadenceMinutes: Schema.NullOr(NonNegativeInt),
  maxRuns: Schema.NullOr(NonNegativeInt),
  runCount: NonNegativeInt,
  expiresAt: Schema.NullOr(IsoDateTime),
  finishLine: Schema.NullOr(TrimmedNonEmptyString),
  stopConditions: Schema.Array(TrimmedNonEmptyString),
  preventOverlap: Schema.Boolean,
  pauseReason: Schema.NullOr(TrimmedNonEmptyString),
  stopReason: Schema.NullOr(TrimmedNonEmptyString),
  lastReceipt: Schema.NullOr(PortfolioHeartbeatReceipt),
  updatedAt: IsoDateTime,
});
export type PortfolioHeartbeatRecord = typeof PortfolioHeartbeatRecord.Type;

export const PortfolioHeartbeatRecordsReadback = Schema.Struct({
  owner: PortfolioHeartbeatOwnerReadback,
  records: Schema.Array(PortfolioHeartbeatRecord),
});
export type PortfolioHeartbeatRecordsReadback = typeof PortfolioHeartbeatRecordsReadback.Type;

export const PortfolioHeartbeatOwnerClaimRequest = Schema.Struct({
  target: PortfolioTarget,
  portfolioRevision: NonNegativeInt,
  heartbeatRevision: NonNegativeInt,
  portfolioChecksum: TrimmedNonEmptyString,
  heartbeatChecksum: TrimmedNonEmptyString,
});
export type PortfolioHeartbeatOwnerClaimRequest = typeof PortfolioHeartbeatOwnerClaimRequest.Type;

/** Explicit operator assertion required before an owner transfer can be staged. */
export const PortfolioHeartbeatOwnerTransferPrepareRequest = Schema.Struct({
  targetOwnerEnvironmentId: EnvironmentId,
  proposedOwnerEpoch: NonNegativeInt,
  heartbeatsPaused: Schema.Literal(true),
});
export type PortfolioHeartbeatOwnerTransferPrepareRequest =
  typeof PortfolioHeartbeatOwnerTransferPrepareRequest.Type;

/**
 * Transfer ticket copied from the current owner to the target owner. The
 * ticket carries the complete continuity proof; the target must not accept a
 * partial or newly invented descriptor.
 */
export const PortfolioHeartbeatOwnerTransferTicket = Schema.Struct({
  transferId: TrimmedNonEmptyString,
  sourceOwnerEnvironmentId: EnvironmentId,
  targetOwnerEnvironmentId: EnvironmentId,
  ownerEpoch: NonNegativeInt,
  portfolioRevision: NonNegativeInt,
  heartbeatRevision: NonNegativeInt,
  portfolioChecksum: TrimmedNonEmptyString,
  heartbeatChecksum: TrimmedNonEmptyString,
  target: PortfolioTarget,
  lastReceipt: Schema.NullOr(PortfolioHeartbeatReceipt),
  records: Schema.optionalKey(Schema.Array(PortfolioHeartbeatRecord)),
  preparedAt: IsoDateTime,
  heartbeatsPaused: Schema.Literal(true),
});
export type PortfolioHeartbeatOwnerTransferTicket =
  typeof PortfolioHeartbeatOwnerTransferTicket.Type;
