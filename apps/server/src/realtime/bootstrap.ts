import {
  AuthOrchestrationOperateScope,
  PositiveInt,
  RealtimeClientSecretRequest,
  RealtimeClientSecretResponse,
  RealtimeModel,
} from "@t3tools/contracts";
import * as Config from "effect/Config";
import * as Data from "effect/Data";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import {
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
  HttpRouter,
  HttpServerRequest,
  HttpServerRespondable,
  HttpServerResponse,
} from "effect/unstable/http";

import { authenticateRawRouteWithScope } from "../http.ts";
import { ProjectionSnapshotQuery } from "../orchestration/Services/ProjectionSnapshotQuery.ts";
import { buildRealtimeThreadContext, RealtimeContextSelectionError } from "./context.ts";
import { loadRealtimeDocuments } from "./documents.ts";

const CREDENTIAL_HEADERS = { "cache-control": "no-store", pragma: "no-cache" };
const decodeClientSecretResponse = Schema.decodeUnknownEffect(RealtimeClientSecretResponse);
const MODEL = "gpt-realtime-2.1";
const UpstreamClientSecret = Schema.Struct({
  value: Schema.String.check(Schema.isNonEmpty(), Schema.isTrimmed()),
  expires_at: PositiveInt,
  session: Schema.Struct({ type: Schema.Literal("realtime"), model: RealtimeModel }),
});

class RealtimeBootstrapError extends Data.TaggedError("RealtimeBootstrapError")<{
  readonly status: 400 | 404 | 502 | 503;
  readonly message: string;
}> {}

/** Uses the canonical projection queries; tests inject those same reads and HTTP transport. */
export const realtimeBootstrapResponse = Effect.fn("realtime.bootstrap")(
  function* (
    query: Pick<ProjectionSnapshotQuery["Service"], "getProjectShellById" | "getThreadDetailById">,
  ) {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const input = yield* request.json.pipe(
      Effect.flatMap(
        Schema.decodeUnknownEffect(RealtimeClientSecretRequest, { onExcessProperty: "error" }),
      ),
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
    if (Option.isNone(project) || project.value.id !== input.projectId) {
      return yield* new RealtimeBootstrapError({
        status: 404,
        message: "Project or thread not found.",
      });
    }
    const thread = yield* query
      .getThreadDetailById(input.threadId)
      .pipe(
        Effect.mapError(
          () => new RealtimeBootstrapError({ status: 503, message: "Thread context unavailable." }),
        ),
      );
    if (
      Option.isNone(thread) ||
      thread.value.id !== input.threadId ||
      thread.value.projectId !== input.projectId ||
      thread.value.deletedAt !== null
    ) {
      return yield* new RealtimeBootstrapError({
        status: 404,
        message: "Project or thread not found.",
      });
    }
    const selectedDocuments = yield* loadRealtimeDocuments(
      project.value.workspaceRoot,
      input.documentPaths ?? [],
    ).pipe(
      Effect.mapError(
        () =>
          new RealtimeBootstrapError({ status: 400, message: "Invalid project document path." }),
      ),
    );
    const context = yield* Effect.try({
      try: () =>
        buildRealtimeThreadContext({
          thread: thread.value,
          projectTitle: project.value.title,
          documents: selectedDocuments.documents,
          documentWarnings: selectedDocuments.warnings,
          documentsTruncated: selectedDocuments.truncated,
          ...(input.selectedMessageId !== undefined
            ? { selectedMessageId: input.selectedMessageId }
            : {}),
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
    if (!apiKey.trim()) {
      return yield* new RealtimeBootstrapError({
        status: 503,
        message: "Realtime is not configured.",
      });
    }
    const client = yield* HttpClient.HttpClient;
    const secret = yield* HttpClientRequest.post(
      "https://api.openai.com/v1/realtime/client_secrets",
    ).pipe(
      HttpClientRequest.bearerToken(apiKey),
      HttpClientRequest.bodyJson({
        session: {
          type: "realtime",
          model: MODEL,
          audio: {
            input: { transcription: { model: "gpt-4o-mini-transcribe" } },
            output: { voice: "marin" },
          },
          instructions: context.instructions,
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
    if (secret.expires_at <= now.epochMilliseconds / 1000) {
      return yield* new RealtimeBootstrapError({
        status: 502,
        message: "Realtime bootstrap failed.",
      });
    }
    const response = yield* decodeClientSecretResponse({
      clientSecret: secret.value,
      expiresAt: secret.expires_at,
      model: MODEL,
      context: context.provenance,
      warnings: context.warnings,
    }).pipe(
      Effect.mapError(
        () => new RealtimeBootstrapError({ status: 503, message: "Thread context unavailable." }),
      ),
    );
    return HttpServerResponse.jsonUnsafe(response, { headers: CREDENTIAL_HEADERS });
  },
  Effect.catchTag("RealtimeBootstrapError", (error) =>
    Effect.succeed(
      HttpServerResponse.jsonUnsafe(
        { error: error.message },
        { status: error.status, headers: CREDENTIAL_HEADERS },
      ),
    ),
  ),
);

export const realtimeClientSecretsRouteLayer = HttpRouter.add(
  "POST",
  "/api/realtime/client-secrets",
  Effect.gen(function* () {
    yield* authenticateRawRouteWithScope(AuthOrchestrationOperateScope);
    const query = yield* ProjectionSnapshotQuery;
    return yield* realtimeBootstrapResponse(query);
  }).pipe(
    Effect.catchTags({
      EnvironmentAuthInvalidError: HttpServerRespondable.toResponse,
      EnvironmentInternalError: HttpServerRespondable.toResponse,
      EnvironmentScopeRequiredError: HttpServerRespondable.toResponse,
    }),
    Effect.map((response) => HttpServerResponse.setHeaders(response, CREDENTIAL_HEADERS)),
  ),
);
