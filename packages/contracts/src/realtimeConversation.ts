import * as Schema from "effect/Schema";
import { NonNegativeInt } from "./baseSchemas.ts";

const ExactId = Schema.String.check(
  Schema.isNonEmpty(),
  Schema.isTrimmed(),
  Schema.isMaxLength(512),
);
const Source = {
  projectId: ExactId.pipe(Schema.brand("ProjectId")),
  threadId: ExactId.pipe(Schema.brand("ThreadId")),
};
const ConversationThreadId = Schema.String.check(
  Schema.isNonEmpty(),
  Schema.isTrimmed(),
  Schema.isMaxLength(1024),
).pipe(Schema.brand("ThreadId"));
export const RealtimeConversationOpenRequest = Schema.Struct(Source);
export type RealtimeConversationOpenRequest = typeof RealtimeConversationOpenRequest.Type;

export const RealtimeConversationMessage = Schema.Struct({
  id: Schema.String,
  role: Schema.Literals(["user", "assistant"]),
  text: Schema.String,
  createdAt: Schema.String,
});
export type RealtimeConversationMessage = typeof RealtimeConversationMessage.Type;
export const RealtimeConversationOpenResponse = Schema.Struct({
  conversationThreadId: ConversationThreadId,
  messages: Schema.Array(RealtimeConversationMessage),
  // Earliest included completed-message index. Full history is available via context/read_thread.
  nextOffset: Schema.NullOr(NonNegativeInt),
});
export type RealtimeConversationOpenResponse = typeof RealtimeConversationOpenResponse.Type;

export const RealtimeConversationMessagesRequest = Schema.Struct({
  ...Source,
  conversationThreadId: ConversationThreadId,
  sessionId: ExactId,
  items: Schema.Array(
    Schema.Struct({
      id: ExactId,
      role: Schema.Literals(["user", "assistant"]),
      text: Schema.String.check(Schema.isNonEmpty(), Schema.isMaxLength(60000)),
    }),
  ).check(Schema.isMinLength(1), Schema.isMaxLength(50)),
});
export type RealtimeConversationMessagesRequest = typeof RealtimeConversationMessagesRequest.Type;
export const RealtimeConversationMessagesResponse = Schema.Struct({
  conversationThreadId: ConversationThreadId,
  saved: NonNegativeInt,
});
export type RealtimeConversationMessagesResponse = typeof RealtimeConversationMessagesResponse.Type;
