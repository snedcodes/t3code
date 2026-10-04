import { describe, expect, it } from "@effect/vitest";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { CommandId, ProjectId, ProviderInstanceId, ThreadId } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as ConfigProvider from "effect/ConfigProvider";
import { HttpClient, HttpClientResponse } from "effect/unstable/http";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Stream from "effect/Stream";
import { OrchestrationCommandInvariantError } from "../orchestration/Errors.ts";
import { OrchestrationEngineLive } from "../orchestration/Layers/OrchestrationEngine.ts";
import { OrchestrationProjectionPipelineLive } from "../orchestration/Layers/ProjectionPipeline.ts";
import { OrchestrationProjectionSnapshotQueryLive } from "../orchestration/Layers/ProjectionSnapshotQuery.ts";
import { OrchestrationEngineService } from "../orchestration/Services/OrchestrationEngine.ts";
import { ProjectionSnapshotQuery } from "../orchestration/Services/ProjectionSnapshotQuery.ts";
import * as ThreadBackgroundLiveness from "../orchestration/ThreadBackgroundLiveness.ts";
import * as ThreadPlanProgress from "../orchestration/ThreadPlanProgress.ts";
import { OrchestrationCommandReceiptRepositoryLive } from "../persistence/Layers/OrchestrationCommandReceipts.ts";
import { OrchestrationEventStoreLive } from "../persistence/Layers/OrchestrationEventStore.ts";
import { SqlitePersistenceMemory } from "../persistence/Layers/Sqlite.ts";
import * as RepositoryIdentityResolver from "../project/RepositoryIdentityResolver.ts";
import { ServerConfig } from "../config.ts";
import { makeRealtimeConversations } from "./conversations.ts";
import * as Conversations from "./conversations.ts";
import * as Bootstrap from "./RealtimeBootstrap.ts";

const layer = Layer.mergeAll(
  OrchestrationEngineLive.pipe(
    Layer.provide(OrchestrationProjectionSnapshotQueryLive),
    Layer.provide(OrchestrationProjectionPipelineLive),
  ),
  OrchestrationProjectionSnapshotQueryLive,
).pipe(
  Layer.provideMerge(ThreadBackgroundLiveness.layer),
  Layer.provide(ThreadPlanProgress.layer),
  Layer.provide(OrchestrationEventStoreLive),
  Layer.provideMerge(OrchestrationCommandReceiptRepositoryLive),
  Layer.provide(
    Layer.succeed(RepositoryIdentityResolver.RepositoryIdentityResolver, {
      resolve: () => Effect.succeed(null),
    }),
  ),
  Layer.provide(SqlitePersistenceMemory),
  Layer.provideMerge(ServerConfig.layerTest(process.cwd(), { prefix: "t3-voice-history-test-" })),
  Layer.provideMerge(NodeServices.layer),
);

const setup = Effect.gen(function* () {
  const engine = yield* OrchestrationEngineService;
  const query = yield* ProjectionSnapshotQuery;
  const projectId = ProjectId.make("project");
  const threadId = ThreadId.make("source");
  const at = "2026-10-04T00:00:00.000Z";
  yield* engine.dispatch({
    type: "project.create",
    commandId: CommandId.make("project"),
    projectId,
    title: "Voice project",
    workspaceRoot: "/unused-voice-fixture",
    createdAt: at,
  });
  yield* engine.dispatch({
    type: "thread.create",
    commandId: CommandId.make("source"),
    threadId,
    projectId,
    title: "Coding source",
    modelSelection: { instanceId: ProviderInstanceId.make("codex"), model: "gpt-5.4" },
    runtimeMode: "full-access",
    interactionMode: "default",
    branch: null,
    worktreePath: null,
    createdAt: at,
  });
  const service = yield* makeRealtimeConversations(query, engine);
  return { engine, query, service, input: { projectId, threadId }, at };
});

describe("durable realtime conversations", () => {
  it.effect(
    "mints exact release thread context and rejects wrong targets before provider access",
    () => {
      const requests: string[] = [];
      const http = HttpClient.make((request) =>
        Effect.sync(() => {
          requests.push(request.url);
          return HttpClientResponse.fromWeb(
            request,
            Response.json({
              value: "test_ephemeral",
              expires_at: 2_000_000_000,
              session: { type: "realtime", model: "gpt-realtime-2.1" },
            }),
          );
        }),
      );
      const bootstrapLayer = Bootstrap.layer.pipe(
        Layer.provideMerge(Conversations.realtimeConversationsLayer),
        Layer.provideMerge(layer),
        Layer.provide(Layer.succeed(HttpClient.HttpClient, http)),
        Layer.provide(
          ConfigProvider.layer(ConfigProvider.fromUnknown({ OPENAI_API_KEY: "mock_server_key" })),
        ),
      );
      return Effect.gen(function* () {
        const { input, service } = yield* setup;
        const opened = yield* service.open(input);
        yield* service.save({
          ...input,
          conversationThreadId: opened.conversationThreadId,
          sessionId: "bootstrap",
          items: [{ id: "saved", role: "user", text: "Our earlier voice conversation." }],
        });
        const bootstrap = yield* Bootstrap.RealtimeBootstrap;
        const result = yield* bootstrap.create(input);
        expect(result.model).toBe("gpt-realtime-2.1");
        expect(result.context.threadId).toBe(input.threadId);
        expect(result.context.conversationThreadId).toBe(opened.conversationThreadId);
        expect(result.context.conversationMessageCount).toBe(1);
        expect(result.context.tasksLoaded).toBe(false);
        expect(result.warnings.join(" ")).toContain("no Portfolio owner");
        expect(requests).toEqual(["https://api.openai.com/v1/realtime/client_secrets"]);
        const wrongTarget = yield* bootstrap
          .create({ ...input, projectId: "different" })
          .pipe(Effect.flip);
        expect(wrongTarget.status).toBe(404);
        const wrongSelection = yield* bootstrap
          .create({ ...input, selectedMessageId: "missing" })
          .pipe(Effect.flip);
        expect(wrongSelection.status).toBe(400);
        expect(requests).toHaveLength(1);
      }).pipe(Effect.provide(bootstrapLayer));
    },
  );
  it.effect(
    "loads existing without creation and idempotently opens exact associated companion",
    () =>
      Effect.gen(function* () {
        const { service, engine, query, input } = yield* setup;
        const sequence = yield* engine.latestSequence;
        expect(yield* service.loadExisting(input)).toBeNull();
        expect(yield* engine.latestSequence).toBe(sequence);
        const opened = yield* service.open(input);
        expect(opened).toEqual({
          conversationThreadId: "voice-assistant:source",
          messages: [],
          nextOffset: null,
        });
        const createdSequence = yield* engine.latestSequence;
        expect(yield* service.open(input)).toEqual(opened);
        expect(yield* engine.latestSequence).toBe(createdSequence);
        const companion = Option.getOrThrow(
          yield* query.getThreadDetailSnapshot(opened.conversationThreadId),
        ).thread;
        expect(companion.title).toBe("Voice assistant · Coding source");
        expect(companion.session).toBeNull();
        expect(companion.latestTurn).toBeNull();
      }).pipe(Effect.provide(layer)),
  );
  it.effect(
    "saves completed user/assistant once with canonical receipts and never writes coding source or starts turn",
    () =>
      Effect.gen(function* () {
        const { service, engine, query, input } = yield* setup;
        const { conversationThreadId } = yield* service.open(input);
        const request = {
          ...input,
          conversationThreadId,
          sessionId: "session",
          items: [
            { id: "u", role: "user" as const, text: "Question" },
            { id: "a", role: "assistant" as const, text: "Answer" },
          ],
        };
        expect((yield* service.save(request)).saved).toBe(2);
        const sequence = yield* engine.latestSequence;
        expect((yield* service.save(request)).saved).toBe(0);
        expect(yield* engine.latestSequence).toBe(sequence);
        const companion = Option.getOrThrow(
          yield* query.getThreadDetailSnapshot(conversationThreadId),
        ).thread;
        expect(companion.messages.map((m) => [m.role, m.text, m.streaming, m.turnId])).toEqual([
          ["user", "Question", false, null],
          ["assistant", "Answer", false, null],
        ]);
        expect(
          Option.getOrThrow(yield* query.getThreadDetailSnapshot(input.threadId)).thread.messages,
        ).toEqual([]);
        const events = yield* engine
          .readThreadEvents({
            threadId: conversationThreadId,
            fromSequenceExclusive: 0,
            toSequenceInclusive: sequence,
          })
          .pipe(Stream.runCollect);
        expect(events.some((e) => e.type === "thread.turn-start-requested")).toBe(false);
        expect((yield* service.loadExisting(input))?.messages.map((m) => m.text)).toEqual([
          "Question",
          "Answer",
        ]);
      }).pipe(Effect.provide(layer)),
  );
  it.effect(
    "rejects namespace collision, foreign association, and missing exact source before writes",
    () =>
      Effect.gen(function* () {
        const { service, engine, input, at } = yield* setup;
        const collision = ThreadId.make("voice-assistant:source");
        yield* engine.dispatch({
          type: "thread.create",
          commandId: CommandId.make("unrelated-create"),
          threadId: collision,
          projectId: input.projectId,
          title: "Voice assistant · Coding source",
          modelSelection: { instanceId: ProviderInstanceId.make("codex"), model: "gpt-5.4" },
          runtimeMode: "full-access",
          interactionMode: "default",
          branch: null,
          worktreePath: null,
          createdAt: at,
        });
        const sequence = yield* engine.latestSequence;
        expect((yield* service.open(input).pipe(Effect.flip)).status).toBe(409);
        expect(
          (yield* service
            .open({ ...input, projectId: ProjectId.make("missing") })
            .pipe(Effect.flip)).status,
        ).toBe(404);
        expect(
          (yield* service
            .save({
              ...input,
              conversationThreadId: input.threadId,
              sessionId: "s",
              items: [{ id: "a", role: "user", text: "Do not write source" }],
            })
            .pipe(Effect.flip)).status,
        ).toBe(409);
        expect(yield* engine.latestSequence).toBe(sequence);
      }).pipe(Effect.provide(layer)),
  );
  it.effect(
    "preflights content conflicts and rejects extra/streaming fields without any writes",
    () =>
      Effect.gen(function* () {
        const { service, engine, input } = yield* setup;
        const { conversationThreadId } = yield* service.open(input);
        const sequence = yield* engine.latestSequence;
        const request = {
          ...input,
          conversationThreadId,
          sessionId: "s",
          items: [
            { id: "same", role: "user" as const, text: "one" },
            { id: "same", role: "user" as const, text: "two" },
          ],
        };
        expect((yield* service.save(request).pipe(Effect.flip)).status).toBe(409);
        const partial = {
          ...request,
          items: [{ id: "x", role: "user" as const, text: "partial", streaming: true }],
        };
        expect((yield* service.save(partial).pipe(Effect.flip)).status).toBe(400);
        expect(yield* engine.latestSequence).toBe(sequence);
      }).pipe(Effect.provide(layer)),
  );
  it.effect(
    "recovers assistant completion after interrupted delta without duplicate text, including a new service instance",
    () =>
      Effect.gen(function* () {
        const { service, engine, query, input } = yield* setup;
        const { conversationThreadId } = yield* service.open(input);
        const interrupted = yield* makeRealtimeConversations(query, {
          ...engine,
          dispatch: (command) =>
            command.type === "thread.message.assistant.complete"
              ? Effect.fail(
                  new OrchestrationCommandInvariantError({
                    commandType: command.type,
                    detail: "Injected completion interruption",
                  }),
                )
              : engine.dispatch(command),
        });
        const request = {
          ...input,
          conversationThreadId,
          sessionId: "s",
          items: [{ id: "a", role: "assistant" as const, text: "Complete answer" }],
        };
        expect((yield* interrupted.save(request).pipe(Effect.flip)).status).toBe(503);
        expect((yield* service.loadExisting(input))?.messages).toEqual([]);
        const resumed = yield* makeRealtimeConversations(query, engine);
        expect((yield* resumed.save(request)).saved).toBe(1);
        expect((yield* resumed.save(request)).saved).toBe(0);
        const messages = Option.getOrThrow(
          yield* query.getThreadDetailSnapshot(conversationThreadId),
        ).thread.messages;
        expect(messages.map((m) => [m.text, m.streaming])).toEqual([["Complete answer", false]]);
      }).pipe(Effect.provide(layer)),
  );
  it.effect(
    "bounds initial latest history while preserving every completed utterance in canonical detail",
    () =>
      Effect.gen(function* () {
        const { service, query, input } = yield* setup;
        const { conversationThreadId } = yield* service.open(input);
        for (let start = 0; start < 110; start += 50) {
          yield* service.save({
            ...input,
            conversationThreadId,
            sessionId: "history",
            items: Array.from({ length: Math.min(50, 110 - start) }, (_, i) => ({
              id: `item-${start + i}`,
              role: "user" as const,
              text: `Completed ${start + i}`,
            })),
          });
        }
        const opened = yield* service.open(input);
        expect(opened.messages).toHaveLength(100);
        expect(opened.messages[0]?.text).toBe("Completed 10");
        expect(opened.nextOffset).toBe(10);
        expect(
          Option.getOrThrow(yield* query.getThreadDetailSnapshot(conversationThreadId)).thread
            .messages,
        ).toHaveLength(110);
      }).pipe(Effect.provide(layer)),
  );
});
