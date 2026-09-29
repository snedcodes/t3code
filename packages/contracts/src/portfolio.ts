import * as Schema from "effect/Schema";
import {
  EnvironmentId,
  IsoDateTime,
  NonNegativeInt,
  PositiveInt,
  ProjectId,
  RuntimeTaskId,
  ThreadId,
  TrimmedNonEmptyString,
} from "./baseSchemas.ts";

export const PortfolioTarget = Schema.Struct({ environmentId: EnvironmentId, projectId: ProjectId, threadId: ThreadId });
export type PortfolioTarget = typeof PortfolioTarget.Type;

export const PortfolioTaskStatus = Schema.Literals(["draft", "ready", "in_progress", "blocked", "complete", "cancelled"]);
export type PortfolioTaskStatus = typeof PortfolioTaskStatus.Type;
export const PortfolioChecklistState = Schema.Literals(["open", "in_progress", "blocked", "complete"]);
export type PortfolioChecklistState = typeof PortfolioChecklistState.Type;

export const PortfolioChecklistItem = Schema.Struct({
  itemId: TrimmedNonEmptyString,
  text: TrimmedNonEmptyString,
  state: PortfolioChecklistState,
  evidence: Schema.NullOr(TrimmedNonEmptyString),
  updatedBy: Schema.optionalKey(Schema.NullOr(TrimmedNonEmptyString)),
  updatedAt: IsoDateTime,
});
export type PortfolioChecklistItem = typeof PortfolioChecklistItem.Type;

export const PortfolioDocumentLink = Schema.Struct({
  linkId: TrimmedNonEmptyString,
  repository: TrimmedNonEmptyString,
  relativePath: TrimmedNonEmptyString,
  owningHost: TrimmedNonEmptyString,
  title: TrimmedNonEmptyString,
  gitRevision: Schema.NullOr(TrimmedNonEmptyString),
  primary: Schema.optionalKey(Schema.Boolean),
});
export type PortfolioDocumentLink = typeof PortfolioDocumentLink.Type;

export const PortfolioReceipt = Schema.Struct({
  commandId: TrimmedNonEmptyString,
  target: PortfolioTarget,
  status: Schema.Literals(["accepted", "dispatched", "transcript-confirmed", "confirmation-delayed", "uncertain", "failed"]),
  sequence: Schema.optionalKey(NonNegativeInt),
  observedAt: IsoDateTime,
  detail: TrimmedNonEmptyString,
});
export type PortfolioReceipt = typeof PortfolioReceipt.Type;

export const PortfolioTask = Schema.Struct({
  taskId: RuntimeTaskId,
  title: TrimmedNonEmptyString,
  outcome: TrimmedNonEmptyString,
  target: PortfolioTarget,
  status: PortfolioTaskStatus,
  priority: TrimmedNonEmptyString,
  ownerPassportId: Schema.NullOr(TrimmedNonEmptyString),
  ownerHost: Schema.NullOr(TrimmedNonEmptyString),
  checklistItems: Schema.Array(PortfolioChecklistItem),
  completionCondition: TrimmedNonEmptyString,
  planLinks: Schema.Array(PortfolioDocumentLink),
  evidenceLinks: Schema.Array(PortfolioDocumentLink),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
  completedAt: Schema.NullOr(IsoDateTime),
  revision: PositiveInt,
  lastReceipt: Schema.NullOr(PortfolioReceipt),
  heartbeatId: Schema.NullOr(TrimmedNonEmptyString),
});
export type PortfolioTask = typeof PortfolioTask.Type;

export const PortfolioTaskWriteRequest = Schema.Struct({
  expectedRevision: Schema.NullOr(PositiveInt),
  task: PortfolioTask,
});
export type PortfolioTaskWriteRequest = typeof PortfolioTaskWriteRequest.Type;
export const PortfolioTasksReadback = Schema.Struct({
  ownerEnvironmentId: EnvironmentId,
  tasks: Schema.Array(PortfolioTask),
});
export type PortfolioTasksReadback = typeof PortfolioTasksReadback.Type;

export const PortfolioHeartbeatStatus = Schema.Literals(["paused", "active", "stopped", "completed", "blocked", "expired", "exhausted"]);
export type PortfolioHeartbeatStatus = typeof PortfolioHeartbeatStatus.Type;
export const PortfolioHeartbeat = Schema.Struct({
  heartbeatId: TrimmedNonEmptyString,
  taskId: Schema.NullOr(RuntimeTaskId),
  message: Schema.NullOr(TrimmedNonEmptyString),
  target: PortfolioTarget,
  status: PortfolioHeartbeatStatus,
  cadenceMinutes: Schema.NullOr(PositiveInt),
  nextRunAt: Schema.NullOr(IsoDateTime),
  maxRuns: Schema.NullOr(PositiveInt),
  runCount: NonNegativeInt,
  expiresAt: Schema.NullOr(IsoDateTime),
  stopConditions: Schema.Array(TrimmedNonEmptyString),
  preventOverlap: Schema.Boolean,
  stopReason: Schema.NullOr(TrimmedNonEmptyString),
  lastReceipt: Schema.NullOr(PortfolioReceipt),
  updatedAt: IsoDateTime,
  revision: PositiveInt,
});
export type PortfolioHeartbeat = typeof PortfolioHeartbeat.Type;
export const PortfolioHeartbeatWriteRequest = Schema.Struct({
  expectedRevision: Schema.NullOr(PositiveInt),
  heartbeat: PortfolioHeartbeat,
});
export type PortfolioHeartbeatWriteRequest = typeof PortfolioHeartbeatWriteRequest.Type;
export const PortfolioHeartbeatsReadback = Schema.Struct({
  ownerEnvironmentId: EnvironmentId,
  heartbeats: Schema.Array(PortfolioHeartbeat),
});
export type PortfolioHeartbeatsReadback = typeof PortfolioHeartbeatsReadback.Type;
export const PortfolioReceiptWriteRequest = Schema.Struct({
  heartbeatId: TrimmedNonEmptyString,
  expectedRevision: PositiveInt,
  receipt: PortfolioReceipt,
});
export type PortfolioReceiptWriteRequest = typeof PortfolioReceiptWriteRequest.Type;
