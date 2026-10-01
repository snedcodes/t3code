import * as Schema from "effect/Schema";
import { NonNegativeInt, PositiveInt, ProjectId, ThreadId } from "./baseSchemas.ts";

export const RealtimeModel = Schema.Literal("gpt-realtime-2.1");
const ExactId = Schema.String.check(Schema.isNonEmpty(), Schema.isTrimmed());

export const RealtimeClientSecretRequest = Schema.Struct({
  projectId: ExactId.pipe(Schema.brand("ProjectId")),
  threadId: ExactId.pipe(Schema.brand("ThreadId")),
  selectedMessageId: Schema.optional(ExactId.pipe(Schema.brand("MessageId"))),
});
export type RealtimeClientSecretRequest = typeof RealtimeClientSecretRequest.Type;

export const RealtimeContextProvenance = Schema.Struct({
  projectId: ProjectId,
  threadId: ThreadId,
  threadUpdatedAt: Schema.String,
  messageIds: Schema.Array(Schema.String),
  messageCount: NonNegativeInt,
  selectedMessageId: Schema.NullOr(Schema.String),
  latestTurnId: Schema.NullOr(Schema.String),
  truncated: Schema.Boolean,
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
