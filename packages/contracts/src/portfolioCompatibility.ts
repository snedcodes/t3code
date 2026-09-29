import * as Schema from "effect/Schema";
import { EnvironmentId, IsoDateTime, NonNegativeInt, PositiveInt, RuntimeTaskId, TrimmedNonEmptyString } from "./baseSchemas.ts";
import { PortfolioHeartbeat, PortfolioReceipt, PortfolioTarget, PortfolioTask, PortfolioChecklistItem, PortfolioDocumentLink, PortfolioTaskStatus } from "./portfolio.ts";

export type PortfolioTaskView = Omit<PortfolioTask, "ownerPassportId" | "ownerHost"> & {
  readonly assignment: { readonly ownerPassportId: string | null; readonly ownerHost: string | null };
};
export type PortfolioTaskCreateRequest = PortfolioTaskView;

export const PortfolioHeartbeatReceiptStatus = PortfolioReceipt.fields.status;
export type PortfolioHeartbeatReceiptStatus = typeof PortfolioHeartbeatReceiptStatus.Type;
export const PortfolioHeartbeatReceipt = PortfolioReceipt;
export type PortfolioHeartbeatReceipt = typeof PortfolioHeartbeatReceipt.Type;

export const PortfolioHeartbeatOwnerRole = Schema.Literals(["owner", "non_owner", "owner_unavailable"]);
export type PortfolioHeartbeatOwnerRole = typeof PortfolioHeartbeatOwnerRole.Type;
export const PortfolioHeartbeatOwnerClaimRequest = Schema.Struct({
  target: PortfolioTarget,
  portfolioRevision: NonNegativeInt,
  heartbeatRevision: NonNegativeInt,
  portfolioChecksum: TrimmedNonEmptyString,
  heartbeatChecksum: TrimmedNonEmptyString,
});
export type PortfolioHeartbeatOwnerClaimRequest = typeof PortfolioHeartbeatOwnerClaimRequest.Type;

export const PortfolioTaskUpdateRequest = Schema.Struct({
  taskId: RuntimeTaskId,
  target: PortfolioTarget,
  expectedRevision: PositiveInt,
  title: TrimmedNonEmptyString,
  outcome: TrimmedNonEmptyString,
  priority: TrimmedNonEmptyString,
  completionCondition: TrimmedNonEmptyString,
  checklistItems: Schema.Array(PortfolioChecklistItem),
  evidenceLinks: Schema.Array(PortfolioDocumentLink),
  heartbeatId: Schema.NullOr(TrimmedNonEmptyString),
  updatedAt: IsoDateTime,
});
export type PortfolioTaskUpdateRequest = typeof PortfolioTaskUpdateRequest.Type;

export const PortfolioWishlistStatus = Schema.Literals(["idea", "clarifying", "designing", "ready", "promoted", "implemented", "declined"]);
export type PortfolioWishlistStatus = typeof PortfolioWishlistStatus.Type;
export const PortfolioWishlist = Schema.Struct({
  wishlistId: TrimmedNonEmptyString,
  title: TrimmedNonEmptyString,
  summary: TrimmedNonEmptyString,
  status: PortfolioWishlistStatus,
  priority: TrimmedNonEmptyString,
  links: Schema.Array(PortfolioDocumentLink),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
  revision: PositiveInt,
  promotedTaskId: Schema.NullOr(RuntimeTaskId),
});
export type PortfolioWishlist = typeof PortfolioWishlist.Type;
export const PortfolioWishlistsReadback = Schema.Struct({
  ownerEnvironmentId: EnvironmentId,
  wishlists: Schema.Array(PortfolioWishlist),
});
export type PortfolioWishlistsReadback = typeof PortfolioWishlistsReadback.Type;
export const PortfolioWishlistWriteRequest = Schema.Struct({
  expectedRevision: Schema.NullOr(PositiveInt),
  wishlist: PortfolioWishlist,
});
export type PortfolioWishlistWriteRequest = typeof PortfolioWishlistWriteRequest.Type;
export const PortfolioWishlistPromotionRequest = Schema.Struct({
  wishlistId: TrimmedNonEmptyString,
  expectedRevision: PositiveInt,
  promotedTaskId: RuntimeTaskId,
  updatedAt: IsoDateTime,
});
export type PortfolioWishlistPromotionRequest = typeof PortfolioWishlistPromotionRequest.Type;
export type PortfolioTaskStatusTransitionRequest = {
  readonly taskId: PortfolioTask["taskId"];
  readonly target: PortfolioTarget;
  readonly expectedRevision: PortfolioTask["revision"];
  readonly status: typeof PortfolioTaskStatus.Type;
  readonly updatedAt: string;
};
export type PortfolioHeartbeatUpsertRequest = Omit<typeof PortfolioHeartbeat.Type, "status" | "runCount" | "revision" | "stopReason" | "nextRunAt" | "lastReceipt" | "updatedAt"> & {
  readonly enabled: boolean;
  readonly activeRunId: string | null;
  readonly disabledReason: string | null;
  readonly nextRunAt: string | null;
  readonly runCount: number;
  readonly lastReceipt: PortfolioHeartbeatReceipt | null;
  readonly updatedAt: string;
};
export const PortfolioHeartbeatRecord = Schema.Struct({
  heartbeatId: TrimmedNonEmptyString,
  revision: Schema.optionalKey(PositiveInt),
  taskId: Schema.optionalKey(Schema.NullOr(RuntimeTaskId)),
  message: Schema.optionalKey(Schema.NullOr(TrimmedNonEmptyString)),
  nextRunAt: Schema.optionalKey(Schema.NullOr(IsoDateTime)),
  target: PortfolioTarget,
  enabled: Schema.Boolean,
  activeRunId: Schema.NullOr(TrimmedNonEmptyString),
  disabledReason: Schema.NullOr(TrimmedNonEmptyString),
  cadenceMinutes: Schema.NullOr(NonNegativeInt),
  maxRuns: Schema.NullOr(NonNegativeInt),
  runCount: NonNegativeInt,
  expiresAt: Schema.NullOr(IsoDateTime),
  finishLine: Schema.NullOr(TrimmedNonEmptyString),
  stopConditions: Schema.Array(TrimmedNonEmptyString),
  preventOverlap: Schema.Boolean,
  lastReceipt: Schema.NullOr(PortfolioHeartbeatReceipt),
  updatedAt: IsoDateTime,
});
export type PortfolioHeartbeatRecord = typeof PortfolioHeartbeatRecord.Type;
