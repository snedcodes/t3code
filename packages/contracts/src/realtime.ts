import * as Schema from "effect/Schema";
import * as Effect from "effect/Effect";
import { NonNegativeInt, PositiveInt, ProjectId, ThreadId } from "./baseSchemas.ts";
import { PortfolioTaskStatus } from "./portfolio.ts";

export const RealtimeModel = Schema.Literal("gpt-realtime-2.1");
const ExactId = Schema.String.check(Schema.isNonEmpty(), Schema.isTrimmed());

export const RealtimeClientSecretRequest = Schema.Struct({
  projectId: ExactId.pipe(Schema.brand("ProjectId")),
  threadId: ExactId.pipe(Schema.brand("ThreadId")),
  selectedMessageId: Schema.optional(ExactId.pipe(Schema.brand("MessageId"))),
  documentPaths: Schema.optional(Schema.Array(ExactId).check(Schema.isMaxLength(3))),
});
export type RealtimeClientSecretRequest = typeof RealtimeClientSecretRequest.Type;

export const RealtimeDocumentProvenance = Schema.Struct({
  path: Schema.String,
  title: Schema.String,
  bytesIncluded: NonNegativeInt,
  truncated: Schema.Boolean,
});
export type RealtimeDocumentProvenance = typeof RealtimeDocumentProvenance.Type;

export const RealtimeContextProvenance = Schema.Struct({
  projectId: ProjectId,
  threadId: ThreadId,
  threadUpdatedAt: Schema.String,
  messageIds: Schema.Array(Schema.String),
  messageCount: NonNegativeInt,
  selectedMessageId: Schema.NullOr(Schema.String),
  latestTurnId: Schema.NullOr(Schema.String),
  truncated: Schema.Boolean,
  documents: Schema.Array(RealtimeDocumentProvenance).pipe(
    Schema.withDecodingDefault(Effect.succeed([])),
  ),
  documentsTruncated: Schema.Boolean.pipe(Schema.withDecodingDefault(Effect.succeed(false))),
  tasks: Schema.Array(
    Schema.Struct({
      taskId: Schema.String,
      revision: PositiveInt,
      updatedAt: Schema.String,
      status: PortfolioTaskStatus,
      threadId: ThreadId,
    }),
  ).pipe(Schema.withDecodingDefault(Effect.succeed([]))),
  tasksLoaded: Schema.Boolean.pipe(Schema.withDecodingDefault(Effect.succeed(false))),
  tasksTruncated: Schema.Boolean.pipe(Schema.withDecodingDefault(Effect.succeed(false))),
});
export type RealtimeContextProvenance = typeof RealtimeContextProvenance.Type;

export const RealtimeClientSecretResponse = Schema.Struct({
  clientSecret: Schema.String.check(Schema.isNonEmpty()),
  // Unix timestamp in seconds, matching the upstream client-secret expiry.
  expiresAt: PositiveInt,
  model: RealtimeModel,
  context: RealtimeContextProvenance,
  warnings: Schema.Array(Schema.String),
});
export type RealtimeClientSecretResponse = typeof RealtimeClientSecretResponse.Type;
