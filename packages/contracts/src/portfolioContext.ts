import * as Schema from "effect/Schema";
import { EnvironmentId, NonNegativeInt, PositiveInt, ProjectId, ThreadId } from "./baseSchemas.ts";

export const PortfolioContextOperation = Schema.Literals([
  "list_projects",
  "list_threads",
  "read_thread",
  "search_files",
  "read_file",
  "read_portfolio",
]);
export const PortfolioContextReadRequest = Schema.Struct({
  operation: PortfolioContextOperation,
  projectId: Schema.optional(ProjectId),
  threadId: Schema.optional(ThreadId),
  query: Schema.optional(Schema.String.check(Schema.isMaxLength(256))),
  path: Schema.optional(Schema.String.check(Schema.isNonEmpty(), Schema.isMaxLength(4096))),
  offset: Schema.optional(
    NonNegativeInt.check(Schema.isLessThanOrEqualTo(Number.MAX_SAFE_INTEGER)),
  ),
  limit: Schema.optional(PositiveInt.check(Schema.isLessThanOrEqualTo(100))),
  maxChars: Schema.optional(PositiveInt.check(Schema.isLessThanOrEqualTo(60000))),
});
export type PortfolioContextReadRequest = typeof PortfolioContextReadRequest.Type;

export const PortfolioContextReadResponse = Schema.Struct({
  environmentId: EnvironmentId,
  operation: PortfolioContextOperation,
  data: Schema.Json,
  nextOffset: Schema.NullOr(NonNegativeInt),
  truncated: Schema.Boolean,
});
export type PortfolioContextReadResponse = typeof PortfolioContextReadResponse.Type;
