import {
  AuthOrchestrationOperateScope,
  AuthOrchestrationReadScope,
  CommandId,
  EnvironmentHttpApi,
  EnvironmentId,
  IsoDateTime,
  NonNegativeInt,
  PortfolioHeartbeatReceiptStatus,
  PortfolioHeartbeatOwnerTransferTicket,
  PortfolioHeartbeatReceipt,
  ProjectId,
  ThreadId,
} from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as References from "effect/References";
import * as Schema from "effect/Schema";
import { Command, Flag, GlobalFlag } from "effect/unstable/cli";
import { FetchHttpClient } from "effect/unstable/http";
import * as HttpApiClient from "effect/unstable/httpapi/HttpApiClient";

import * as EnvironmentAuth from "../auth/EnvironmentAuth.ts";
import * as ServerConfig from "../config.ts";
import { readPersistedServerRuntimeState } from "../serverRuntimeState.ts";
import { baseDirFlag, resolveCliAuthConfig } from "./config.ts";

const nonNegativeRevision = (name: string, description: string) =>
  Flag.integer(name).pipe(Flag.withSchema(Schema.Int), Flag.withDescription(description));

class NoRunningPortfolioServerError extends Schema.TaggedErrorClass<NoRunningPortfolioServerError>()(
  "NoRunningPortfolioServerError",
  { statePath: Schema.String },
) {
  override get message(): string {
    return `No running T3 server was found for ${this.statePath}.`;
  }
}

class PortfolioRevisionMustBeNonNegativeError extends Schema.TaggedErrorClass<PortfolioRevisionMustBeNonNegativeError>()(
  "PortfolioRevisionMustBeNonNegativeError",
  { name: Schema.String, value: Schema.Number },
) {
  override get message(): string {
    return `${this.name} must be a non-negative integer (received ${this.value}).`;
  }
}

class PortfolioTransferPausedAssertionRequiredError extends Schema.TaggedErrorClass<PortfolioTransferPausedAssertionRequiredError>()(
  "PortfolioTransferPausedAssertionRequiredError",
  {},
) {
  override get message(): string {
    return "Owner transfer requires --heartbeats-paused as an explicit operator assertion.";
  }
}

const transferTicketFileFlag = Flag.string("ticket-file").pipe(
  Flag.withDescription(
    "Path to the JSON transfer ticket produced by prepare-heartbeat-owner-transfer.",
  ),
);

const readTransferTicket = (ticketFile: string) =>
  Effect.gen(function* () {
    const fileSystem = yield* FileSystem.FileSystem;
    const raw = yield* fileSystem.readFileString(ticketFile);
    return yield* Schema.decodeUnknownEffect(
      Schema.fromJsonString(PortfolioHeartbeatOwnerTransferTicket),
    )(raw);
  });

const encodeJson = Schema.encodeUnknownSync(Schema.fromJsonString(Schema.Unknown));
const transferReadbackOutput = (readback: unknown) => Console.log(encodeJson(readback));

const receiptStatusFlag = Flag.choice("status", PortfolioHeartbeatReceiptStatus.literals).pipe(
  Flag.withDescription("Native Heartbeat receipt status to persist."),
);

const optionalSequenceFlag = Flag.integer("sequence").pipe(
  Flag.withSchema(Schema.Int),
  Flag.withDescription("Optional native dispatch sequence."),
  Flag.optional,
);

const readHeartbeatOwnerCommand = Command.make("read-heartbeat-owner", {
  baseDir: baseDirFlag,
}).pipe(
  Command.withDescription("Read the current native Heartbeat owner through the running T3 server."),
  Command.withHandler((flags) =>
    Effect.gen(function* () {
      const logLevel = yield* GlobalFlag.LogLevel;
      const config = yield* resolveCliAuthConfig({ baseDir: flags.baseDir }, logLevel);
      const runtimeState = yield* readPersistedServerRuntimeState(config.serverRuntimeStatePath);
      if (Option.isNone(runtimeState)) {
        return yield* new NoRunningPortfolioServerError({
          statePath: config.serverRuntimeStatePath,
        });
      }

      yield* Effect.gen(function* () {
        const environmentAuth = yield* EnvironmentAuth.EnvironmentAuth;
        const issued = yield* environmentAuth.issueSession({
          scopes: [AuthOrchestrationReadScope],
          label: "t3 portfolio heartbeat owner read",
        });

        try {
          const client = yield* HttpApiClient.make(EnvironmentHttpApi, {
            baseUrl: runtimeState.value.origin,
          });
          yield* client.portfolio
            .heartbeatOwner({
              headers: { authorization: `Bearer ${issued.token}` },
            })
            .pipe(Effect.flatMap(transferReadbackOutput));
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

const claimHeartbeatOwnerCommand = Command.make("claim-heartbeat-owner", {
  baseDir: baseDirFlag,
  targetEnvironmentId: Flag.string("target-environment-id"),
  projectId: Flag.string("project-id"),
  threadId: Flag.string("thread-id"),
  portfolioRevision: nonNegativeRevision(
    "portfolio-revision",
    "Canonical Portfolio revision supplied by the operator.",
  ),
  heartbeatRevision: nonNegativeRevision(
    "heartbeat-revision",
    "Canonical Heartbeat revision supplied by the operator.",
  ),
  portfolioChecksum: Flag.string("portfolio-checksum"),
  heartbeatChecksum: Flag.string("heartbeat-checksum"),
}).pipe(
  Command.withDescription(
    "Claim the canonical Heartbeat owner for a target in the running T3 server.",
  ),
  Command.withHandler((flags) =>
    Effect.gen(function* () {
      const logLevel = yield* GlobalFlag.LogLevel;
      const config = yield* resolveCliAuthConfig({ baseDir: flags.baseDir }, logLevel);
      if (flags.portfolioRevision < 0) {
        return yield* new PortfolioRevisionMustBeNonNegativeError({
          name: "portfolio-revision",
          value: flags.portfolioRevision,
        });
      }
      if (flags.heartbeatRevision < 0) {
        return yield* new PortfolioRevisionMustBeNonNegativeError({
          name: "heartbeat-revision",
          value: flags.heartbeatRevision,
        });
      }
      const runtimeState = yield* readPersistedServerRuntimeState(config.serverRuntimeStatePath);
      if (Option.isNone(runtimeState)) {
        return yield* new NoRunningPortfolioServerError({
          statePath: config.serverRuntimeStatePath,
        });
      }

      yield* Effect.gen(function* () {
        const environmentAuth = yield* EnvironmentAuth.EnvironmentAuth;
        const issued = yield* environmentAuth.issueSession({
          scopes: [AuthOrchestrationOperateScope],
          label: "t3 portfolio heartbeat owner claim",
        });

        try {
          const client = yield* HttpApiClient.make(EnvironmentHttpApi, {
            baseUrl: runtimeState.value.origin,
          });
          const readback = yield* client.portfolio.claimHeartbeatOwner({
            headers: { authorization: `Bearer ${issued.token}` },
            payload: {
              target: {
                environmentId: EnvironmentId.make(flags.targetEnvironmentId),
                projectId: ProjectId.make(flags.projectId),
                threadId: ThreadId.make(flags.threadId),
              },
              portfolioRevision: flags.portfolioRevision,
              heartbeatRevision: flags.heartbeatRevision,
              portfolioChecksum: flags.portfolioChecksum,
              heartbeatChecksum: flags.heartbeatChecksum,
            },
          });
          yield* Console.log(
            [
              `role=${readback.role}`,
              `freshness=${readback.freshness}`,
              `ownerEnvironmentId=${readback.descriptor?.ownerEnvironmentId ?? "none"}`,
              `ownerEpoch=${readback.descriptor?.ownerEpoch ?? "none"}`,
              `target=${readback.descriptor?.target?.threadId ?? "none"}`,
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

const prepareHeartbeatOwnerTransferCommand = Command.make("prepare-heartbeat-owner-transfer", {
  baseDir: baseDirFlag,
  targetOwnerEnvironmentId: Flag.string("target-owner-environment-id"),
  proposedOwnerEpoch: nonNegativeRevision(
    "proposed-owner-epoch",
    "Next owner epoch, greater than the current owner epoch.",
  ),
  heartbeatsPaused: Flag.boolean("heartbeats-paused").pipe(
    Flag.withDescription("Explicitly assert that Heartbeats are paused before preparing transfer."),
    Flag.withDefault(false),
  ),
}).pipe(
  Command.withDescription(
    "Prepare a paused Heartbeat owner transfer and print its complete JSON ticket.",
  ),
  Command.withHandler((flags) =>
    Effect.gen(function* () {
      if (!flags.heartbeatsPaused) {
        return yield* new PortfolioTransferPausedAssertionRequiredError();
      }
      if (flags.proposedOwnerEpoch < 0) {
        return yield* new PortfolioRevisionMustBeNonNegativeError({
          name: "proposed-owner-epoch",
          value: flags.proposedOwnerEpoch,
        });
      }
      const logLevel = yield* GlobalFlag.LogLevel;
      const config = yield* resolveCliAuthConfig({ baseDir: flags.baseDir }, logLevel);
      const runtimeState = yield* readPersistedServerRuntimeState(config.serverRuntimeStatePath);
      if (Option.isNone(runtimeState)) {
        return yield* new NoRunningPortfolioServerError({
          statePath: config.serverRuntimeStatePath,
        });
      }

      yield* Effect.gen(function* () {
        const environmentAuth = yield* EnvironmentAuth.EnvironmentAuth;
        const issued = yield* environmentAuth.issueSession({
          scopes: [AuthOrchestrationOperateScope],
          label: "t3 portfolio heartbeat owner transfer prepare",
        });

        try {
          const client = yield* HttpApiClient.make(EnvironmentHttpApi, {
            baseUrl: runtimeState.value.origin,
          });
          const ticket = yield* client.portfolio.prepareHeartbeatOwnerTransfer({
            headers: { authorization: `Bearer ${issued.token}` },
            payload: {
              targetOwnerEnvironmentId: EnvironmentId.make(flags.targetOwnerEnvironmentId),
              proposedOwnerEpoch: flags.proposedOwnerEpoch,
              heartbeatsPaused: true,
            },
          });
          yield* Console.log(encodeJson(ticket));
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

const recordHeartbeatReceiptCommand = Command.make("record-heartbeat-receipt", {
  baseDir: baseDirFlag,
  commandId: Flag.string("command-id"),
  environmentId: Flag.string("environment-id"),
  projectId: Flag.string("project-id"),
  threadId: Flag.string("thread-id"),
  status: receiptStatusFlag,
  sequence: optionalSequenceFlag,
  observedAt: Flag.string("observed-at").pipe(
    Flag.withDescription("ISO timestamp; defaults to the current time."),
    Flag.optional,
  ),
  detail: Flag.string("detail"),
}).pipe(
  Command.withDescription("Persist one typed native Heartbeat receipt through the current owner."),
  Command.withHandler((flags) =>
    Effect.gen(function* () {
      if (Option.isSome(flags.sequence) && flags.sequence.value < 0) {
        return yield* new PortfolioRevisionMustBeNonNegativeError({
          name: "sequence",
          value: flags.sequence.value,
        });
      }
      const observedAtInput = Option.isSome(flags.observedAt)
        ? flags.observedAt.value
        : DateTime.formatIso(yield* DateTime.now);
      const observedAt = yield* Schema.decodeUnknownEffect(IsoDateTime)(observedAtInput);
      const receipt = yield* Schema.decodeUnknownEffect(PortfolioHeartbeatReceipt)({
        commandId: CommandId.make(flags.commandId),
        target: {
          environmentId: EnvironmentId.make(flags.environmentId),
          projectId: ProjectId.make(flags.projectId),
          threadId: ThreadId.make(flags.threadId),
        },
        status: flags.status,
        ...(Option.isNone(flags.sequence)
          ? {}
          : { sequence: NonNegativeInt.make(flags.sequence.value) }),
        observedAt,
        detail: flags.detail,
      });
      const logLevel = yield* GlobalFlag.LogLevel;
      const config = yield* resolveCliAuthConfig({ baseDir: flags.baseDir }, logLevel);
      const runtimeState = yield* readPersistedServerRuntimeState(config.serverRuntimeStatePath);
      if (Option.isNone(runtimeState)) {
        return yield* new NoRunningPortfolioServerError({
          statePath: config.serverRuntimeStatePath,
        });
      }

      yield* Effect.gen(function* () {
        const environmentAuth = yield* EnvironmentAuth.EnvironmentAuth;
        const issued = yield* environmentAuth.issueSession({
          scopes: [AuthOrchestrationOperateScope],
          label: "t3 portfolio heartbeat receipt",
        });

        try {
          const client = yield* HttpApiClient.make(EnvironmentHttpApi, {
            baseUrl: runtimeState.value.origin,
          });
          yield* client.portfolio
            .recordHeartbeatReceipt({
              headers: { authorization: `Bearer ${issued.token}` },
              payload: receipt,
            })
            .pipe(Effect.flatMap(transferReadbackOutput));
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

const acceptHeartbeatOwnerTransferCommand = Command.make("accept-heartbeat-owner-transfer", {
  baseDir: baseDirFlag,
  ticketFile: transferTicketFileFlag,
}).pipe(
  Command.withDescription("Accept a prepared Heartbeat owner transfer on its target environment."),
  Command.withHandler((flags) =>
    Effect.gen(function* () {
      const ticket = yield* readTransferTicket(flags.ticketFile);
      const logLevel = yield* GlobalFlag.LogLevel;
      const config = yield* resolveCliAuthConfig({ baseDir: flags.baseDir }, logLevel);
      const runtimeState = yield* readPersistedServerRuntimeState(config.serverRuntimeStatePath);
      if (Option.isNone(runtimeState)) {
        return yield* new NoRunningPortfolioServerError({
          statePath: config.serverRuntimeStatePath,
        });
      }

      yield* Effect.gen(function* () {
        const environmentAuth = yield* EnvironmentAuth.EnvironmentAuth;
        const issued = yield* environmentAuth.issueSession({
          scopes: [AuthOrchestrationOperateScope],
          label: "t3 portfolio heartbeat owner transfer accept",
        });

        try {
          const client = yield* HttpApiClient.make(EnvironmentHttpApi, {
            baseUrl: runtimeState.value.origin,
          });
          yield* client.portfolio
            .acceptHeartbeatOwnerTransfer({
              headers: { authorization: `Bearer ${issued.token}` },
              payload: ticket,
            })
            .pipe(Effect.flatMap(transferReadbackOutput));
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

const finalizeHeartbeatOwnerTransferCommand = Command.make("finalize-heartbeat-owner-transfer", {
  baseDir: baseDirFlag,
  ticketFile: transferTicketFileFlag,
}).pipe(
  Command.withDescription(
    "Finalize a previously accepted Heartbeat owner transfer on its source environment.",
  ),
  Command.withHandler((flags) =>
    Effect.gen(function* () {
      const ticket = yield* readTransferTicket(flags.ticketFile);
      const logLevel = yield* GlobalFlag.LogLevel;
      const config = yield* resolveCliAuthConfig({ baseDir: flags.baseDir }, logLevel);
      const runtimeState = yield* readPersistedServerRuntimeState(config.serverRuntimeStatePath);
      if (Option.isNone(runtimeState)) {
        return yield* new NoRunningPortfolioServerError({
          statePath: config.serverRuntimeStatePath,
        });
      }

      yield* Effect.gen(function* () {
        const environmentAuth = yield* EnvironmentAuth.EnvironmentAuth;
        const issued = yield* environmentAuth.issueSession({
          scopes: [AuthOrchestrationOperateScope],
          label: "t3 portfolio heartbeat owner transfer finalize",
        });

        try {
          const client = yield* HttpApiClient.make(EnvironmentHttpApi, {
            baseUrl: runtimeState.value.origin,
          });
          yield* client.portfolio
            .finalizeHeartbeatOwnerTransfer({
              headers: { authorization: `Bearer ${issued.token}` },
              payload: ticket,
            })
            .pipe(Effect.flatMap(transferReadbackOutput));
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

export const portfolioCommand = Command.make("portfolio").pipe(
  Command.withDescription("Inspect and control native Portfolio state."),
  Command.withSubcommands([
    readHeartbeatOwnerCommand,
    claimHeartbeatOwnerCommand,
    recordHeartbeatReceiptCommand,
    prepareHeartbeatOwnerTransferCommand,
    acceptHeartbeatOwnerTransferCommand,
    finalizeHeartbeatOwnerTransferCommand,
  ]),
);
