import {
  AuthAdministrativeScopes,
  CommandId,
  EnvironmentHttpApi,
  MessageId,
  type OrchestrationReadModel,
  type OrchestrationThread,
} from "@t3tools/contracts";
import * as Console from "effect/Console";
import * as Crypto from "effect/Crypto";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as References from "effect/References";
import * as Schema from "effect/Schema";
import { Argument, Command, Flag, GlobalFlag } from "effect/unstable/cli";
import { FetchHttpClient, HttpClient } from "effect/unstable/http";
import * as HttpApiClient from "effect/unstable/httpapi/HttpApiClient";

import * as EnvironmentAuth from "../auth/EnvironmentAuth.ts";
import * as ServerConfig from "../config.ts";
import { readPersistedServerRuntimeState } from "../serverRuntimeState.ts";
import { type CliAuthLocationFlags, projectLocationFlags, resolveCliAuthConfig } from "./config.ts";

const LIVE_TIMEOUT = Duration.seconds(3);

export type SidebandTarget = {
  readonly projectTitle: string;
  readonly threadTitle: string;
  /** Internal only: callers never provide this identifier. */
  readonly thread: OrchestrationThread;
};

export class SidebandTargetNotFoundError extends Schema.TaggedErrorClass<SidebandTargetNotFoundError>()(
  "SidebandTargetNotFoundError",
  { projectTitle: Schema.String, threadTitle: Schema.String },
) {
  override get message(): string {
    return `No active thread named '${this.threadTitle}' exists in project '${this.projectTitle}'.`;
  }
}

export class SidebandTargetAmbiguousError extends Schema.TaggedErrorClass<SidebandTargetAmbiguousError>()(
  "SidebandTargetAmbiguousError",
  { projectTitle: Schema.String, threadTitle: Schema.String, count: Schema.Number },
) {
  override get message(): string {
    return `Thread '${this.threadTitle}' is ambiguous in project '${this.projectTitle}' (${this.count} matches).`;
  }
}

export class SidebandLiveServerUnavailableError extends Schema.TaggedErrorClass<SidebandLiveServerUnavailableError>()(
  "SidebandLiveServerUnavailableError",
  {},
) {
  override get message(): string {
    return "No running local T3 orchestration server is available for sideband dispatch.";
  }
}

export class SidebandLiveServerRequestError extends Schema.TaggedErrorClass<SidebandLiveServerRequestError>()(
  "SidebandLiveServerRequestError",
  { cause: Schema.Defect() },
) {
  override get message(): string {
    return "Failed to call the running server for sideband dispatch.";
  }
}

/** Resolve only an exact active project/title pair from the owning host snapshot. */
export const resolveExactSidebandTarget = (input: {
  readonly snapshot: OrchestrationReadModel;
  readonly projectTitle: string;
  readonly threadTitle: string;
}): SidebandTarget => {
  const projects = input.snapshot.projects.filter(
    (project) => project.deletedAt === null && project.title === input.projectTitle,
  );
  const projectIds = new Set(projects.map((project) => project.id));
  const matches = input.snapshot.threads.filter(
    (thread) =>
      projectIds.has(thread.projectId) &&
      thread.archivedAt === null &&
      thread.title === input.threadTitle,
  );
  if (matches.length === 0) {
    throw new SidebandTargetNotFoundError({
      projectTitle: input.projectTitle,
      threadTitle: input.threadTitle,
    });
  }
  if (matches.length !== 1) {
    throw new SidebandTargetAmbiguousError({
      projectTitle: input.projectTitle,
      threadTitle: input.threadTitle,
      count: matches.length,
    });
  }
  return { projectTitle: input.projectTitle, threadTitle: input.threadTitle, thread: matches[0]! };
};

export const withSidebandSession = <A, E, R>(
  auth: EnvironmentAuth.EnvironmentAuth["Service"],
  run: (token: string) => Effect.Effect<A, E, R>,
) =>
  Effect.acquireUseRelease(
    auth
      .issueSession({ scopes: AuthAdministrativeScopes, label: "t3 sideband dispatch" })
      // The desktop server may briefly hold its own SQLite write transaction.
      // Session issuance is the only sideband step that writes locally; a few
      // bounded retries let that transaction finish without changing delivery
      // semantics or falling back to another transport.
      .pipe(Effect.retry({ times: 4 })),
    (issued) => run(issued.token),
    (issued) => auth.revokeSession(issued.sessionId).pipe(Effect.ignore({ log: true })),
  );

type EffectSuccess<T> = T extends Effect.Effect<infer A, infer _E, infer _R> ? A : never;
type SidebandClient = EffectSuccess<ReturnType<typeof makeClient>>;

const call = <A, E>(
  origin: string,
  f: (client: SidebandClient) => Effect.Effect<A, E, HttpClient.HttpClient>,
) =>
  Effect.gen(function* () {
    const client = yield* makeClient(origin);
    return yield* f(client);
  }).pipe(
    Effect.timeout(LIVE_TIMEOUT),
    Effect.mapError((cause) => new SidebandLiveServerRequestError({ cause })),
  );

const makeClient = (origin: string) => HttpApiClient.make(EnvironmentHttpApi, { baseUrl: origin });

type SidebandFlags = CliAuthLocationFlags & {
  readonly project: string;
  readonly title: string;
  readonly message: string;
  readonly json: boolean;
};

const runSidebandSendEffect = Effect.fn("runSidebandSend")(function* (
  flags: SidebandFlags,
  config: ServerConfig.ServerConfig["Service"],
) {
  const runtime = yield* readPersistedServerRuntimeState(config.serverRuntimeStatePath);
  if (Option.isNone(runtime)) return yield* new SidebandLiveServerUnavailableError({});
  const auth = yield* EnvironmentAuth.EnvironmentAuth;
  const receipt = yield* withSidebandSession(auth, (token) =>
    Effect.gen(function* () {
      const snapshot = yield* call(runtime.value.origin, (client) =>
        client.orchestration.snapshot({ headers: { authorization: `Bearer ${token}` } }),
      );
      const target = resolveExactSidebandTarget({
        snapshot,
        projectTitle: flags.project,
        threadTitle: flags.title,
      });
      const [commandId, messageId, now] = yield* Effect.all([
        Crypto.Crypto.pipe(Effect.flatMap((crypto) => crypto.randomUUIDv4)),
        Crypto.Crypto.pipe(Effect.flatMap((crypto) => crypto.randomUUIDv4)),
        DateTime.now,
      ]);
      const dispatched = yield* call(runtime.value.origin, (client) =>
        client.orchestration.dispatch({
          headers: { authorization: `Bearer ${token}` },
          payload: {
            type: "thread.turn.start",
            commandId: CommandId.make(commandId),
            threadId: target.thread.id,
            message: {
              messageId: MessageId.make(messageId),
              role: "user",
              text: flags.message,
              attachments: [],
            },
            runtimeMode: target.thread.runtimeMode,
            interactionMode: target.thread.interactionMode,
            createdAt: DateTime.formatIso(now),
          },
        } as Parameters<typeof client.orchestration.dispatch>[0]),
      );
      return {
        status: "dispatched",
        project: target.projectTitle,
        title: target.threadTitle,
        sequence: dispatched.sequence,
        transcript: { acceptedUserMessage: true, receipt: "native-orchestration-dispatch" },
      };
    }),
  );
  const output = flags.json
    ? yield* Schema.encodeUnknownEffect(Schema.UnknownFromJsonString)(receipt)
    : `Dispatched to ${receipt.title} in ${receipt.project} (sequence ${receipt.sequence}). Transcript receipt: accepted user message.`;
  yield* Console.log(output);
});

const runSidebandSend = Effect.fn("runSidebandSendCli")(function* (flags: SidebandFlags) {
  const logLevel = yield* GlobalFlag.LogLevel;
  const config = yield* resolveCliAuthConfig(flags, logLevel);
  return yield* runSidebandSendEffect(flags, config).pipe(
    Effect.provide(
      Layer.mergeAll(EnvironmentAuth.runtimeLayer).pipe(
        Layer.provideMerge(FetchHttpClient.layer),
        Layer.provide(ServerConfig.layer(config)),
        Layer.provide(Layer.succeed(References.MinimumLogLevel, "Error")),
      ),
    ),
  );
});

export const sidebandCommand = Command.make("sideband-send", {
  ...projectLocationFlags,
  project: Flag.string("project").pipe(Flag.withDescription("Exact visible project title.")),
  title: Flag.string("title").pipe(Flag.withDescription("Exact visible T3 thread title.")),
  message: Argument.string("message").pipe(Argument.withDescription("User message to dispatch.")),
  json: Flag.boolean("json").pipe(Flag.withDefault(false)),
}).pipe(
  Command.withDescription("Dispatch one message by exact local project and thread title."),
  Command.withHandler((flags) => runSidebandSend(flags)),
);
