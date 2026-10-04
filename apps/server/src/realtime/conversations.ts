import {
  CommandId,
  MessageId,
  ThreadId,
  RealtimeConversationOpenRequest,
  RealtimeConversationMessagesRequest,
  type RealtimeConversationOpenResponse,
  type RealtimeConversationMessagesResponse,
} from "@t3tools/contracts";
import * as Context from "effect/Context";
import * as Crypto from "effect/Crypto";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import * as Stream from "effect/Stream";
import { OrchestrationEngineService } from "../orchestration/Services/OrchestrationEngine.ts";
import { ProjectionSnapshotQuery } from "../orchestration/Services/ProjectionSnapshotQuery.ts";

export class RealtimeConversationError extends Schema.TaggedError<RealtimeConversationError>()(
  "RealtimeConversationError",
  {
    status: Schema.Literals([400, 404, 409, 503]),
    message: Schema.String,
  },
) {}
export class RealtimeConversations extends Context.Service<
  RealtimeConversations,
  {
    readonly open: (
      input: RealtimeConversationOpenRequest,
    ) => Effect.Effect<RealtimeConversationOpenResponse, RealtimeConversationError>;
    readonly save: (
      input: RealtimeConversationMessagesRequest,
    ) => Effect.Effect<RealtimeConversationMessagesResponse, RealtimeConversationError>;
    readonly loadExisting: (
      input: RealtimeConversationOpenRequest,
    ) => Effect.Effect<RealtimeConversationOpenResponse | null, RealtimeConversationError>;
  }
>()("t3/realtime/RealtimeConversations") {}

const decodeOpen = Schema.decodeUnknownEffect(RealtimeConversationOpenRequest, {
  onExcessProperty: "error",
});
const decodeSave = Schema.decodeUnknownEffect(RealtimeConversationMessagesRequest, {
  onExcessProperty: "error",
});
const encodeIdentity = Schema.encodeSync(Schema.fromJsonString(Schema.Array(Schema.String)));
const fail = (status: 400 | 404 | 409 | 503, message: string) =>
  new RealtimeConversationError({ status, message });
const unavailable = () => fail(503, "Voice conversation unavailable.");

/** No source-thread writes or provider turns. Canonical receipts own durability and deduplication. */
export const makeRealtimeConversations = (
  snapshots: Pick<
    ProjectionSnapshotQuery["Service"],
    "getProjectShellById" | "getThreadDetailSnapshot"
  >,
  engine: Pick<
    OrchestrationEngineService["Service"],
    "dispatch" | "readThreadEvents" | "latestSequence"
  >,
) =>
  Effect.gen(function* () {
    const crypto = yield* Crypto.Crypto;
    const mutex = yield* Semaphore.make(1);
    const hash = (parts: ReadonlyArray<string>) =>
      crypto.digest("SHA-256", new TextEncoder().encode(encodeIdentity(parts))).pipe(
        Effect.map((bytes) =>
          Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(""),
        ),
        Effect.mapError(unavailable),
      );
    const source = (input: RealtimeConversationOpenRequest) =>
      Effect.gen(function* () {
        const project = yield* snapshots
          .getProjectShellById(input.projectId)
          .pipe(Effect.mapError(unavailable));
        const snapshot = yield* snapshots
          .getThreadDetailSnapshot(input.threadId, { includeArchived: true })
          .pipe(Effect.mapError(unavailable));
        if (
          Option.isNone(project) ||
          project.value.id !== input.projectId ||
          Option.isNone(snapshot) ||
          snapshot.value.thread.id !== input.threadId ||
          snapshot.value.thread.projectId !== input.projectId ||
          snapshot.value.thread.deletedAt !== null
        )
          return yield* fail(404, "Source project or thread not found.");
        return snapshot.value.thread;
      });
    const companionId = (input: RealtimeConversationOpenRequest) =>
      ThreadId.make(`voice-assistant:${input.threadId}`);
    const creationId = (input: RealtimeConversationOpenRequest) =>
      hash([input.projectId, input.threadId]).pipe(
        Effect.map((id) => CommandId.make(`voice-assistant:create:${id}`)),
      );
    const existing = (input: RealtimeConversationOpenRequest) =>
      Effect.gen(function* () {
        const id = companionId(input);
        const snapshot = yield* snapshots
          .getThreadDetailSnapshot(id, { includeArchived: true })
          .pipe(Effect.mapError(unavailable));
        if (Option.isNone(snapshot)) return null;
        if (
          snapshot.value.thread.id !== id ||
          snapshot.value.thread.projectId !== input.projectId ||
          snapshot.value.thread.deletedAt !== null
        )
          return yield* fail(409, "Voice conversation association conflict.");
        const head = yield* engine.latestSequence;
        const birth = yield* engine
          .readThreadEvents({
            threadId: id,
            fromSequenceExclusive: 0,
            toSequenceInclusive: head,
            limit: 1,
          })
          .pipe(Stream.runHead, Effect.mapError(unavailable));
        const expected = yield* creationId(input);
        // The persisted creation command is the association marker, even if opening crashed immediately afterward.
        if (
          Option.isNone(birth) ||
          birth.value.type !== "thread.created" ||
          birth.value.commandId !== expected ||
          birth.value.payload.threadId !== id ||
          birth.value.payload.projectId !== input.projectId
        )
          return yield* fail(409, "Voice conversation association conflict.");
        return snapshot.value.thread;
      });
    const history = (
      thread: NonNullable<Effect.Success<ReturnType<typeof existing>>>,
    ): RealtimeConversationOpenResponse => {
      const completed = thread.messages.filter(
        (message) =>
          !message.streaming && (message.role === "user" || message.role === "assistant"),
      );
      const start = Math.max(0, completed.length - 100);
      return {
        conversationThreadId: thread.id,
        messages: completed.slice(start).map((message) => ({
          id: message.id,
          role: message.role === "user" ? "user" : "assistant",
          text: message.text,
          createdAt: message.createdAt,
        })),
        nextOffset: start > 0 ? start : null,
      };
    };
    const loadExisting = Effect.fn("realtime.conversations.loadExisting")(function* (
      request: RealtimeConversationOpenRequest,
    ) {
      const input = yield* decodeOpen(request).pipe(
        Effect.mapError(() => fail(400, "Invalid voice conversation request.")),
      );
      yield* source(input);
      const thread = yield* existing(input);
      return thread ? history(thread) : null;
    });
    const open = Effect.fn("realtime.conversations.open")(
      (request: RealtimeConversationOpenRequest) =>
        mutex.withPermits(1)(
          Effect.gen(function* () {
            const input = yield* decodeOpen(request).pipe(
              Effect.mapError(() => fail(400, "Invalid voice conversation request.")),
            );
            const original = yield* source(input);
            let thread = yield* existing(input);
            if (!thread) {
              const now = DateTime.formatIso(yield* DateTime.now);
              yield* engine
                .dispatch({
                  type: "thread.create",
                  commandId: yield* creationId(input),
                  threadId: companionId(input),
                  projectId: input.projectId,
                  title: `Voice assistant · ${original.title}`,
                  modelSelection: original.modelSelection,
                  runtimeMode: original.runtimeMode,
                  interactionMode: original.interactionMode,
                  branch: null,
                  worktreePath: null,
                  createdAt: now,
                })
                .pipe(Effect.mapError(unavailable));
              thread = yield* existing(input);
              if (!thread) return yield* unavailable();
            }
            return history(thread);
          }),
        ),
    );
    const save = Effect.fn("realtime.conversations.save")(
      (request: RealtimeConversationMessagesRequest) =>
        mutex.withPermits(1)(
          Effect.gen(function* () {
            const input = yield* decodeSave(request).pipe(
              Effect.mapError(() => fail(400, "Invalid voice conversation request.")),
            );
            if (
              input.conversationThreadId !== companionId(input) ||
              input.conversationThreadId === input.threadId
            )
              return yield* fail(409, "Voice conversation association conflict.");
            yield* source({ projectId: input.projectId, threadId: input.threadId });
            const thread = yield* existing(input);
            if (!thread) return yield* fail(404, "Voice conversation not found. Open it first.");
            const known = new Map(
              thread.messages.map((message) => [
                message.id,
                { role: message.role, text: message.text, streaming: message.streaming },
              ]),
            );
            const items = new Map<MessageId, { role: "user" | "assistant"; text: string }>();
            // Check every identity/content collision before writing any item in the batch.
            for (const item of input.items) {
              const id = MessageId.make(
                `voice:${yield* hash([thread.id, input.sessionId, item.id, item.role])}`,
              );
              const prior = items.get(id) ?? known.get(id);
              if (prior && (prior.role !== item.role || prior.text !== item.text))
                return yield* fail(409, "Voice message identity conflict.");
              items.set(id, { role: item.role, text: item.text });
            }
            let saved = 0;
            // Projection orders by createdAt then hashed message ID. Preserve utterance
            // arrival order even when several completed items share the same clock tick.
            const lastTime = thread.messages.reduce((latest, message) => {
              const date = DateTime.make(message.createdAt);
              return Option.isSome(date) ? Math.max(latest, date.value.epochMilliseconds) : latest;
            }, -1);
            let timestamp = Math.max((yield* DateTime.now).epochMilliseconds, lastTime + 1);
            for (const [id, item] of items) {
              const prior = known.get(id);
              if (prior && !prior.streaming) continue;
              const now = DateTime.formatIso(DateTime.makeUnsafe(timestamp++));
              if (item.role === "user") {
                yield* engine
                  .dispatch({
                    type: "thread.message.user.append",
                    commandId: CommandId.make(`${id}:user`),
                    threadId: thread.id,
                    message: { messageId: id, text: item.text, attachments: [] },
                    createdAt: now,
                  })
                  .pipe(Effect.mapError(unavailable));
              } else {
                if (!prior)
                  yield* engine
                    .dispatch({
                      type: "thread.message.assistant.delta",
                      commandId: CommandId.make(`${id}:delta`),
                      threadId: thread.id,
                      messageId: id,
                      delta: item.text,
                      createdAt: now,
                    })
                    .pipe(Effect.mapError(unavailable));
                yield* engine
                  .dispatch({
                    type: "thread.message.assistant.complete",
                    commandId: CommandId.make(`${id}:complete`),
                    threadId: thread.id,
                    messageId: id,
                    createdAt: now,
                  })
                  .pipe(Effect.mapError(unavailable));
              }
              saved++;
            }
            return { conversationThreadId: thread.id, saved };
          }),
        ),
    );
    return RealtimeConversations.of({ open, save, loadExisting });
  });

export const realtimeConversationsLayer = Layer.effect(
  RealtimeConversations,
  Effect.gen(function* () {
    return yield* makeRealtimeConversations(
      yield* ProjectionSnapshotQuery,
      yield* OrchestrationEngineService,
    );
  }),
);
