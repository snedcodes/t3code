import * as Schema from "effect/Schema";

import {
  CommandId,
  EnvironmentId,
  IsoDateTime,
  NonNegativeInt,
  ProjectId,
  PositiveInt,
  RuntimeTaskId,
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

/** Task state is independent from native turn and Heartbeat delivery state. */
export const PortfolioTaskStatus = Schema.Literals([
  "draft",
  "ready",
  "in_progress",
  "blocked",
  "complete",
  "cancelled",
]);
export type PortfolioTaskStatus = typeof PortfolioTaskStatus.Type;

export const PortfolioWishlistStatus = Schema.Literals([
  "idea",
  "clarifying",
  "designing",
  "ready",
  "promoted",
  "implemented",
  "declined",
]);
export type PortfolioWishlistStatus = typeof PortfolioWishlistStatus.Type;

export const PortfolioTaskChecklistState = Schema.Literals([
  "open",
  "in_progress",
  "blocked",
  "complete",
]);
export type PortfolioTaskChecklistState = typeof PortfolioTaskChecklistState.Type;

export const PortfolioTaskChecklistItem = Schema.Struct({
  itemId: TrimmedNonEmptyString,
  text: TrimmedNonEmptyString,
  state: PortfolioTaskChecklistState,
  evidence: Schema.NullOr(TrimmedNonEmptyString),
  updatedBy: Schema.NullOr(TrimmedNonEmptyString),
  updatedAt: IsoDateTime,
});
export type PortfolioTaskChecklistItem = typeof PortfolioTaskChecklistItem.Type;

export const PortfolioTaskDocumentLink = Schema.Struct({
  linkId: TrimmedNonEmptyString,
  repository: TrimmedNonEmptyString,
  relativePath: TrimmedNonEmptyString,
  owningHost: TrimmedNonEmptyString,
  title: TrimmedNonEmptyString,
  gitRevision: Schema.NullOr(TrimmedNonEmptyString),
  primary: Schema.Boolean,
});
export type PortfolioTaskDocumentLink = typeof PortfolioTaskDocumentLink.Type;

export const PortfolioTaskAssignment = Schema.Struct({
  ownerPassportId: Schema.NullOr(TrimmedNonEmptyString),
  ownerHost: Schema.NullOr(TrimmedNonEmptyString),
});
export type PortfolioTaskAssignment = typeof PortfolioTaskAssignment.Type;

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

/**
 * The canonical owner-backed Task. `target` is mandatory: a Task cannot be
 * assigned to a machine or project without an exact native thread.
 */
export const PortfolioTask = Schema.Struct({
  taskId: RuntimeTaskId,
  title: TrimmedNonEmptyString,
  outcome: TrimmedNonEmptyString,
  target: PortfolioTarget,
  status: PortfolioTaskStatus,
  priority: TrimmedNonEmptyString,
  assignment: PortfolioTaskAssignment,
  checklistItems: Schema.Array(PortfolioTaskChecklistItem),
  completionCondition: TrimmedNonEmptyString,
  planLinks: Schema.Array(PortfolioTaskDocumentLink),
  evidenceLinks: Schema.Array(PortfolioTaskDocumentLink),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
  completedAt: Schema.NullOr(IsoDateTime),
  revision: PositiveInt,
  lastReceipt: Schema.NullOr(PortfolioHeartbeatReceipt),
  heartbeatId: Schema.NullOr(TrimmedNonEmptyString),
});
export type PortfolioTask = typeof PortfolioTask.Type;

/** The first canonical write accepts a complete typed Task. */
export const PortfolioTaskCreateRequest = PortfolioTask;
export type PortfolioTaskCreateRequest = PortfolioTask;

export const PortfolioTaskStatusTransitionRequest = Schema.Struct({
  taskId: RuntimeTaskId,
  target: PortfolioTarget,
  expectedRevision: PositiveInt,
  status: PortfolioTaskStatus,
  updatedAt: IsoDateTime,
});
export type PortfolioTaskStatusTransitionRequest = typeof PortfolioTaskStatusTransitionRequest.Type;

export const PortfolioTaskReceiptRecordRequest = Schema.Struct({
  taskId: RuntimeTaskId,
  target: PortfolioTarget,
  expectedRevision: PositiveInt,
  receipt: PortfolioHeartbeatReceipt,
});
export type PortfolioTaskReceiptRecordRequest = typeof PortfolioTaskReceiptRecordRequest.Type;

export const PortfolioWishlist = Schema.Struct({
  wishlistId: TrimmedNonEmptyString,
  title: TrimmedNonEmptyString,
  summary: TrimmedNonEmptyString,
  status: PortfolioWishlistStatus,
  priority: TrimmedNonEmptyString,
  links: Schema.Array(PortfolioTaskDocumentLink),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
  revision: PositiveInt,
  promotedTaskId: Schema.NullOr(RuntimeTaskId),
});
export type PortfolioWishlist = typeof PortfolioWishlist.Type;

export const PortfolioWishlistCreateRequest = PortfolioWishlist;
export type PortfolioWishlistCreateRequest = PortfolioWishlist;

export const PortfolioWishlistPromotionRequest = Schema.Struct({
  wishlistId: TrimmedNonEmptyString,
  expectedRevision: PositiveInt,
  promotedTaskId: RuntimeTaskId,
  updatedAt: IsoDateTime,
});
export type PortfolioWishlistPromotionRequest = typeof PortfolioWishlistPromotionRequest.Type;

export type PortfolioTaskLegacyTargetResolution =
  | { readonly resolved: true; readonly target: PortfolioTarget }
  | { readonly resolved: false; readonly reason: "missing_or_ambiguous_native_target" };

type LegacyRecord = Readonly<Record<string, unknown>>;

function legacyRecord(value: unknown): LegacyRecord | null {
  return typeof value === "object" && value !== null ? (value as LegacyRecord) : null;
}

function legacyText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

type LegacyTargetCandidate =
  | { readonly state: "missing" }
  | { readonly state: "partial" }
  | { readonly state: "resolved"; readonly target: PortfolioTarget };

function legacyTarget(value: unknown): LegacyTargetCandidate {
  const record = legacyRecord(value);
  if (record === null) return { state: "missing" };

  const environmentId = legacyText(record.environmentId ?? record.environment_id);
  const projectId = legacyText(record.projectId ?? record.project_id);
  const threadId = legacyText(record.threadId ?? record.thread_id);
  const hasTargetField =
    "environmentId" in record ||
    "environment_id" in record ||
    "projectId" in record ||
    "project_id" in record ||
    "threadId" in record ||
    "thread_id" in record;
  if (environmentId === null || projectId === null || threadId === null) {
    return { state: hasTargetField ? "partial" : "missing" };
  }

  return {
    state: "resolved",
    target: {
      environmentId: EnvironmentId.make(environmentId),
      projectId: ProjectId.make(projectId),
      threadId: ThreadId.make(threadId),
    },
  };
}

function sameTarget(left: PortfolioTarget, right: PortfolioTarget): boolean {
  return (
    left.environmentId === right.environmentId &&
    left.projectId === right.projectId &&
    left.threadId === right.threadId
  );
}

/**
 * Maps only explicit legacy target identity. Project-only, host-only, and
 * conflicting nested/top-level identities remain unresolved; no IDs are
 * inferred from labels, Passport values, or VoiceTools host records.
 */
export function resolvePortfolioTaskLegacyTarget(
  value: unknown,
): PortfolioTaskLegacyTargetResolution {
  const record = legacyRecord(value);
  if (record === null) {
    return { resolved: false, reason: "missing_or_ambiguous_native_target" };
  }

  const nested = legacyTarget(record.target);
  const topLevel = legacyTarget(record);
  if (nested.state === "partial" || topLevel.state === "partial") {
    return { resolved: false, reason: "missing_or_ambiguous_native_target" };
  }

  if (
    nested.state === "resolved" &&
    topLevel.state === "resolved" &&
    !sameTarget(nested.target, topLevel.target)
  ) {
    return { resolved: false, reason: "missing_or_ambiguous_native_target" };
  }

  const target =
    nested.state === "resolved"
      ? nested.target
      : topLevel.state === "resolved"
        ? topLevel.target
        : null;
  return target === null
    ? { resolved: false, reason: "missing_or_ambiguous_native_target" }
    : { resolved: true, target };
}

/** A revision may advance only, never repeat or move backwards. */
export function isPortfolioTaskRevisionAdvance(
  currentRevision: number,
  nextRevision: number,
): boolean {
  return (
    Number.isSafeInteger(currentRevision) &&
    Number.isSafeInteger(nextRevision) &&
    currentRevision >= 1 &&
    nextRevision > currentRevision
  );
}

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

export const PortfolioTasksReadback = Schema.Struct({
  owner: PortfolioHeartbeatOwnerReadback,
  tasks: Schema.Array(PortfolioTask),
});
export type PortfolioTasksReadback = typeof PortfolioTasksReadback.Type;

export const PortfolioTaskStatusTransitionReadback = Schema.Struct({
  owner: PortfolioHeartbeatOwnerReadback,
  task: Schema.NullOr(PortfolioTask),
});
export type PortfolioTaskStatusTransitionReadback =
  typeof PortfolioTaskStatusTransitionReadback.Type;

export const PortfolioTaskReceiptRecordReadback = PortfolioTaskStatusTransitionReadback;
export type PortfolioTaskReceiptRecordReadback = typeof PortfolioTaskReceiptRecordReadback.Type;

export const PortfolioWishlistsReadback = Schema.Struct({
  owner: PortfolioHeartbeatOwnerReadback,
  wishlists: Schema.Array(PortfolioWishlist),
});
export type PortfolioWishlistsReadback = typeof PortfolioWishlistsReadback.Type;

export const PortfolioWishlistPromotionReadback = Schema.Struct({
  owner: PortfolioHeartbeatOwnerReadback,
  wishlist: PortfolioWishlist,
});
export type PortfolioWishlistPromotionReadback = typeof PortfolioWishlistPromotionReadback.Type;

export const PortfolioHeartbeatLifecycleState = Schema.Literals([
  "paused",
  "active",
  "stopped",
  "completed",
  "blocked",
  "expired",
  "exhausted",
  "finished",
]);
export type PortfolioHeartbeatLifecycleState = typeof PortfolioHeartbeatLifecycleState.Type;

/** Read-only owner-backed Heartbeat configuration; execution remains separate. */
export const PortfolioHeartbeatRecord = Schema.Struct({
  heartbeatId: TrimmedNonEmptyString,
  taskId: Schema.optionalKey(Schema.NullOr(RuntimeTaskId)),
  /** Optional custom prompt; absent records retain the scheduler fallback. */
  message: Schema.optionalKey(Schema.NullOr(TrimmedNonEmptyString)),
  nextRunAt: Schema.optionalKey(Schema.NullOr(IsoDateTime)),
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

/**
 * The first native write seam accepts only a paused record. Execution and
 * lifecycle transitions remain separate from this canonical configuration
 * store.
 */
export const PortfolioHeartbeatRecordUpsertRequest = Schema.Struct({
  heartbeatId: TrimmedNonEmptyString,
  taskId: Schema.optionalKey(Schema.NullOr(RuntimeTaskId)),
  message: Schema.optionalKey(Schema.NullOr(TrimmedNonEmptyString)),
  nextRunAt: Schema.optionalKey(Schema.NullOr(IsoDateTime)),
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
export type PortfolioHeartbeatRecordUpsertRequest =
  typeof PortfolioHeartbeatRecordUpsertRequest.Type;

export const PortfolioHeartbeatRecordReadback = Schema.Struct({
  owner: PortfolioHeartbeatOwnerReadback,
  record: Schema.NullOr(PortfolioHeartbeatRecord),
});
export type PortfolioHeartbeatRecordReadback = typeof PortfolioHeartbeatRecordReadback.Type;

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
