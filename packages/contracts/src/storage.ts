/**
 * Read-only, environment-owned storage health reporting.
 *
 * The server returns measurements for a fixed set of T3/provider roots. This
 * contract deliberately has no path input and no mutation or cleanup action.
 *
 * @module storage
 */
import * as Schema from "effect/Schema";

import { IsoDateTime, NonNegativeInt, TrimmedNonEmptyString } from "./baseSchemas.ts";

export const STORAGE_INVENTORY_CONTRACT_VERSION = 1 as const;

export const StorageInventoryCategory = Schema.Literals([
  "database",
  "transcripts",
  "attachments",
  "logs",
  "cache",
  "worktrees",
  "build-output",
]);
export type StorageInventoryCategory = typeof StorageInventoryCategory.Type;

export const StorageInventoryState = Schema.Literals(["active", "inactive", "unknown"]);
export type StorageInventoryState = typeof StorageInventoryState.Type;

export const StorageInventoryEntry = Schema.Struct({
  label: TrimmedNonEmptyString,
  /** A server-resolved path; clients cannot supply or expand it. */
  path: TrimmedNonEmptyString,
  category: StorageInventoryCategory,
  bytes: NonNegativeInt,
  fileCount: NonNegativeInt,
  oldestModifiedAt: Schema.NullOr(IsoDateTime),
  latestModifiedAt: Schema.NullOr(IsoDateTime),
  state: StorageInventoryState,
  message: Schema.NullOr(TrimmedNonEmptyString),
});
export type StorageInventoryEntry = typeof StorageInventoryEntry.Type;

export const StorageInventory = Schema.Struct({
  contractVersion: Schema.Literal(STORAGE_INVENTORY_CONTRACT_VERSION),
  readAt: IsoDateTime,
  entries: Schema.Array(StorageInventoryEntry),
});
export type StorageInventory = typeof StorageInventory.Type;

export class StorageInventoryReadError extends Schema.TaggedErrorClass<StorageInventoryReadError>()(
  "StorageInventoryReadError",
  {
    reason: Schema.Literal("scanFailed"),
    detail: TrimmedNonEmptyString,
    cause: Schema.optional(Schema.Defect()),
  },
) {
  override get message(): string {
    return "Storage inventory read failed: " + this.detail;
  }
}
