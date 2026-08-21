import {
  AuthOrchestrationOperateScope,
  CommandId,
  EnvironmentHttpApi,
  ThreadId,
  TurnId,
} from "@t3tools/contracts";
import * as Console from "effect/Console";
import * as Crypto from "effect/Crypto";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as References from "effect/References";
import * as Schema from "effect/Schema";
import { Argument, Command, Flag, GlobalFlag } from "effect/unstable/cli";
import { FetchHttpClient } from "effect/unstable/http";
import * as HttpApiClient from "effect/unstable/httpapi/HttpApiClient";

import * as EnvironmentAuth from "../auth/EnvironmentAuth.ts";
import * as ServerConfig from "../config.ts";
import { readPersistedServerRuntimeState } from "../serverRuntimeState.ts";
import { baseDirFlag, resolveCliAuthConfig } from "./config.ts";

const turnIdFlag = Flag.string("turn-id").pipe(
  Flag.withDescription("Optional active orchestration turn ID."),
  Flag.optional,
);

class NoRunningTurnServerError extends Schema.TaggedErrorClass<NoRunningTurnServerError>()(
  "NoRunningTurnServerError",
  { statePath: Schema.String },
) {
  override get message(): string {
    return `No running T3 server was found for ${this.statePath}.`;
  }
}

/**
 * Interrupt a live native T3 turn through the same orchestration HTTP contract
 * used by the application. This deliberately refuses to run offline: an
 * offline engine would not own the live provider session.
 */
const interruptCommand = Command.make("interrupt", {
  baseDir: baseDirFlag,
  threadId: Argument.string("thread-id"),
  turnId: turnIdFlag,
}).pipe(
  Command.withDescription("Interrupt one active turn in the running T3 server."),
  Command.withHandler((flags) =>
    Effect.gen(function* () {
      const logLevel = yield* GlobalFlag.LogLevel;
      const config = yield* resolveCliAuthConfig({ baseDir: flags.baseDir }, logLevel);

      yield* Effect.gen(function* () {
        const runtimeState = yield* readPersistedServerRuntimeState(config.serverRuntimeStatePath);
        if (Option.isNone(runtimeState)) {
          return yield* new NoRunningTurnServerError({
            statePath: config.serverRuntimeStatePath,
          });
        }

        const environmentAuth = yield* EnvironmentAuth.EnvironmentAuth;
        const crypto = yield* Crypto.Crypto;
        const issued = yield* environmentAuth.issueSession({
          scopes: [AuthOrchestrationOperateScope],
          label: "t3 turn interrupt sideband",
        });

        try {
          const client = yield* HttpApiClient.make(EnvironmentHttpApi, {
            baseUrl: runtimeState.value.origin,
          });
          const command = {
            type: "thread.turn.interrupt" as const,
            commandId: CommandId.make(yield* crypto.randomUUIDv4.pipe(Effect.orDie)),
            threadId: ThreadId.make(flags.threadId),
            ...(Option.isSome(flags.turnId) ? { turnId: TurnId.make(flags.turnId.value) } : {}),
            createdAt: DateTime.formatIso(yield* DateTime.now),
          };
          const result = yield* client.orchestration.dispatch({
            headers: { authorization: `Bearer ${issued.token}` },
            payload: command,
          });
          yield* Console.log(
            [
              "accepted=true",
              `sequence=${result.sequence}`,
              `threadId=${flags.threadId}`,
              ...(Option.isSome(flags.turnId) ? [`turnId=${flags.turnId.value}`] : []),
              `server=${runtimeState.value.origin}`,
            ].join(" "),
          );
        } finally {
          yield* environmentAuth.revokeSession(issued.sessionId).pipe(Effect.ignore({ log: true }));
        }
      }).pipe(
        Effect.provide(
          Layer.mergeAll(EnvironmentAuth.runtimeLayer).pipe(
            Layer.provideMerge(FetchHttpClient.layer),
            Layer.provide(ServerConfig.layer(config)),
            Layer.provide(Layer.succeed(References.MinimumLogLevel, "Error")),
          ),
        ),
      );
    }),
  ),
);

export const turnCommand = Command.make("turn").pipe(
  Command.withDescription("Control a live native T3 turn."),
  Command.withSubcommands([interruptCommand]),
);
