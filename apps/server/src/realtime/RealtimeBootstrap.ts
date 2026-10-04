import {
  PositiveInt,
  RealtimeClientSecretRequest,
  RealtimeClientSecretResponse,
  RealtimeModel,
} from "@t3tools/contracts";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/unstable/http";
import { ProjectionSnapshotQuery } from "../orchestration/Services/ProjectionSnapshotQuery.ts";
import * as Conversations from "./conversations.ts";
import { buildRealtimeThreadContext, RealtimeContextSelectionError } from "./context.ts";
import { loadRealtimeDocuments } from "./documents.ts";
import { portfolioRealtimeInstructions, portfolioRealtimeTools } from "./tools.ts";

export class RealtimeBootstrapError extends Schema.TaggedError<RealtimeBootstrapError>()(
  "RealtimeBootstrapError",
  {
    status: Schema.Literals([400, 404, 502, 503]),
    message: Schema.String,
  },
) {}
export class RealtimeBootstrap extends Context.Service<
  RealtimeBootstrap,
  {
    readonly create: (
      input: unknown,
    ) => Effect.Effect<RealtimeClientSecretResponse, RealtimeBootstrapError>;
  }
>()("t3/realtime/Bootstrap") {}
const UpstreamClientSecret = Schema.Struct({
  value: Schema.String.check(Schema.isNonEmpty(), Schema.isTrimmed()),
  expires_at: PositiveInt,
  session: Schema.Struct({ type: Schema.Literal("realtime"), model: RealtimeModel }),
});

const make = Effect.gen(function* () {
  const query = yield* ProjectionSnapshotQuery;
  const conversations = yield* Conversations.RealtimeConversations;
  const client = yield* HttpClient.HttpClient;
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const create = Effect.fn("realtime.bootstrap.create")(function* (raw: unknown) {
    const input = yield* Schema.decodeUnknownEffect(RealtimeClientSecretRequest, {
      onExcessProperty: "error",
    })(raw).pipe(
      Effect.mapError(
        () => new RealtimeBootstrapError({ status: 400, message: "Invalid realtime request." }),
      ),
    );
    const project = yield* query
      .getProjectShellById(input.projectId)
      .pipe(
        Effect.mapError(
          () => new RealtimeBootstrapError({ status: 503, message: "Thread context unavailable." }),
        ),
      );
    const snapshot = yield* query
      .getThreadDetailSnapshot(input.threadId, undefined, { includeArchived: true })
      .pipe(
        Effect.mapError(
          () => new RealtimeBootstrapError({ status: 503, message: "Thread context unavailable." }),
        ),
      );
    if (
      Option.isNone(project) ||
      project.value.id !== input.projectId ||
      Option.isNone(snapshot) ||
      snapshot.value.thread.id !== input.threadId ||
      snapshot.value.thread.projectId !== input.projectId ||
      snapshot.value.thread.deletedAt !== null
    ) {
      return yield* new RealtimeBootstrapError({
        status: 404,
        message: "Project or thread not found.",
      });
    }
    const thread = snapshot.value.thread;
    const projectTitle = project.value.title;
    const selected = yield* loadRealtimeDocuments(
      project.value.workspaceRoot,
      input.documentPaths ?? [],
      input.documentBudgetBytes,
    ).pipe(
      Effect.provideService(FileSystem.FileSystem, fileSystem),
      Effect.provideService(Path.Path, path),
      Effect.mapError(
        () =>
          new RealtimeBootstrapError({ status: 400, message: "Invalid project document path." }),
      ),
    );
    const conversation = yield* conversations
      .loadExisting({ projectId: input.projectId, threadId: input.threadId })
      .pipe(
        Effect.mapError(
          () =>
            new RealtimeBootstrapError({ status: 503, message: "Voice conversation unavailable." }),
        ),
      );
    const context = yield* Effect.try({
      try: () =>
        buildRealtimeThreadContext({
          thread,
          projectTitle,
          conversation,
          documents: selected.documents,
          documentWarnings: selected.warnings,
          documentsTruncated: selected.truncated,
          ...(input.selectedMessageId === undefined
            ? {}
            : { selectedMessageId: input.selectedMessageId }),
        }),
      catch: (error) =>
        new RealtimeBootstrapError({
          status: error instanceof RealtimeContextSelectionError ? 400 : 503,
          message:
            error instanceof RealtimeContextSelectionError
              ? "Selected message is unavailable in this thread."
              : "Thread context unavailable.",
        }),
    });
    const apiKey = yield* Config.string("OPENAI_API_KEY").pipe(
      Effect.mapError(
        () => new RealtimeBootstrapError({ status: 503, message: "Realtime is not configured." }),
      ),
    );
    if (!apiKey.trim())
      return yield* new RealtimeBootstrapError({
        status: 503,
        message: "Realtime is not configured.",
      });
    const secret = yield* HttpClientRequest.post(
      "https://api.openai.com/v1/realtime/client_secrets",
    ).pipe(
      HttpClientRequest.bearerToken(apiKey),
      HttpClientRequest.bodyJson({
        session: {
          type: "realtime",
          model: "gpt-realtime-2.1",
          audio: {
            input: { transcription: { model: "gpt-4o-mini-transcribe" } },
            output: { voice: "marin" },
          },
          instructions:
            input.portfolioAccess === false
              ? `${context.instructions}\n\nPortfolio context access is disabled for this voice session. Answer from its startup context and live conversation only.`
              : `${context.instructions}\n\n${portfolioRealtimeInstructions}`,
          tools: input.portfolioAccess === false ? [] : portfolioRealtimeTools,
          tool_choice: "auto",
        },
      }),
      Effect.flatMap(client.execute),
      Effect.flatMap(HttpClientResponse.filterStatusOk),
      Effect.flatMap(HttpClientResponse.schemaBodyJson(UpstreamClientSecret)),
      Effect.timeout("15 seconds"),
      Effect.mapError(
        () => new RealtimeBootstrapError({ status: 502, message: "Realtime bootstrap failed." }),
      ),
    );
    const now = yield* DateTime.now;
    if (secret.expires_at <= now.epochMilliseconds / 1000)
      return yield* new RealtimeBootstrapError({
        status: 502,
        message: "Realtime bootstrap failed.",
      });
    return yield* Schema.decodeUnknownEffect(RealtimeClientSecretResponse)({
      clientSecret: secret.value,
      expiresAt: secret.expires_at,
      model: "gpt-realtime-2.1",
      context: context.provenance,
      warnings: context.warnings,
    }).pipe(
      Effect.mapError(
        () => new RealtimeBootstrapError({ status: 503, message: "Thread context unavailable." }),
      ),
    );
  });
  return RealtimeBootstrap.of({ create });
});
export const layer = Layer.effect(RealtimeBootstrap, make);
