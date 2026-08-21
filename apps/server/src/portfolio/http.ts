import {
  AuthOrchestrationOperateScope,
  AuthOrchestrationReadScope,
  EnvironmentHttpApi,
  EnvironmentHttpConflictError,
} from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";

import {
  annotateEnvironmentRequest,
  failEnvironmentInternal,
  requireEnvironmentScope,
} from "../auth/http.ts";
import * as ServerEnvironment from "../environment/ServerEnvironment.ts";
import * as PortfolioHeartbeatOwner from "./PortfolioHeartbeatOwner.ts";

export const portfolioHttpApiLayer = HttpApiBuilder.group(
  EnvironmentHttpApi,
  "portfolio",
  Effect.fnUntraced(function* (handlers) {
    const owner = yield* PortfolioHeartbeatOwner.PortfolioHeartbeatOwner;
    const environment = yield* ServerEnvironment.ServerEnvironment;
    return handlers
      .handle(
        "heartbeatOwner",
        Effect.fn("environment.portfolio.heartbeatOwner")(function* (args) {
          yield* annotateEnvironmentRequest(args.endpoint.name);
          yield* requireEnvironmentScope(AuthOrchestrationReadScope);
          return yield* owner.read;
        }),
      )
      .handle(
        "claimHeartbeatOwner",
        Effect.fn("environment.portfolio.claimHeartbeatOwner")(function* (args) {
          yield* annotateEnvironmentRequest(args.endpoint.name);
          yield* requireEnvironmentScope(AuthOrchestrationOperateScope);
          const now = yield* DateTime.now;
          const decision = yield* owner
            .claim({
              ...args.payload,
              ownerEnvironmentId: yield* environment.getEnvironmentId,
              updatedAt: DateTime.formatIso(now),
            })
            .pipe(
              Effect.catchTag("PortfolioHeartbeatOwnerPersistenceError", (error) =>
                failEnvironmentInternal("internal_error", error),
              ),
            );
          if (!decision.accepted) {
            return yield* new EnvironmentHttpConflictError({
              message: `Heartbeat owner claim rejected: ${decision.reason}.`,
            });
          }
          return yield* owner.read;
        }),
      )
      .handle(
        "recordHeartbeatReceipt",
        Effect.fn("environment.portfolio.recordHeartbeatReceipt")(function* (args) {
          yield* annotateEnvironmentRequest(args.endpoint.name);
          yield* requireEnvironmentScope(AuthOrchestrationOperateScope);
          const now = yield* DateTime.now;
          const decision = yield* owner
            .recordReceipt({
              ownerEnvironmentId: yield* environment.getEnvironmentId,
              receipt: args.payload,
              updatedAt: DateTime.formatIso(now),
            })
            .pipe(
              Effect.catchTag("PortfolioHeartbeatOwnerPersistenceError", (error) =>
                failEnvironmentInternal("internal_error", error),
              ),
            );
          if (!decision.accepted) {
            return yield* new EnvironmentHttpConflictError({
              message: `Heartbeat receipt rejected: ${decision.reason}.`,
            });
          }
          return yield* owner.read;
        }),
      )
      .handle(
        "prepareHeartbeatOwnerTransfer",
        Effect.fn("environment.portfolio.prepareHeartbeatOwnerTransfer")(function* (args) {
          yield* annotateEnvironmentRequest(args.endpoint.name);
          yield* requireEnvironmentScope(AuthOrchestrationOperateScope);
          const now = yield* DateTime.now;
          const decision = yield* owner
            .prepareTransfer({
              ...args.payload,
              sourceOwnerEnvironmentId: yield* environment.getEnvironmentId,
              preparedAt: DateTime.formatIso(now),
            })
            .pipe(
              Effect.catchTag("PortfolioHeartbeatOwnerPersistenceError", (error) =>
                failEnvironmentInternal("internal_error", error),
              ),
            );
          if (!decision.accepted || decision.ticket === null) {
            return yield* new EnvironmentHttpConflictError({
              message: `Heartbeat owner transfer preparation rejected: ${decision.reason}.`,
            });
          }
          return decision.ticket;
        }),
      )
      .handle(
        "acceptHeartbeatOwnerTransfer",
        Effect.fn("environment.portfolio.acceptHeartbeatOwnerTransfer")(function* (args) {
          yield* annotateEnvironmentRequest(args.endpoint.name);
          yield* requireEnvironmentScope(AuthOrchestrationOperateScope);
          const now = yield* DateTime.now;
          const decision = yield* owner
            .acceptTransfer({
              ticket: args.payload,
              updatedAt: DateTime.formatIso(now),
            })
            .pipe(
              Effect.catchTag("PortfolioHeartbeatOwnerPersistenceError", (error) =>
                failEnvironmentInternal("internal_error", error),
              ),
            );
          if (!decision.accepted) {
            return yield* new EnvironmentHttpConflictError({
              message: `Heartbeat owner transfer acceptance rejected: ${decision.reason}.`,
            });
          }
          return yield* owner.read;
        }),
      )
      .handle(
        "finalizeHeartbeatOwnerTransfer",
        Effect.fn("environment.portfolio.finalizeHeartbeatOwnerTransfer")(function* (args) {
          yield* annotateEnvironmentRequest(args.endpoint.name);
          yield* requireEnvironmentScope(AuthOrchestrationOperateScope);
          const now = yield* DateTime.now;
          const decision = yield* owner
            .finalizeTransfer({
              ticket: args.payload,
              updatedAt: DateTime.formatIso(now),
            })
            .pipe(
              Effect.catchTag("PortfolioHeartbeatOwnerPersistenceError", (error) =>
                failEnvironmentInternal("internal_error", error),
              ),
            );
          if (!decision.accepted) {
            return yield* new EnvironmentHttpConflictError({
              message: `Heartbeat owner transfer finalization rejected: ${decision.reason}.`,
            });
          }
          return yield* owner.read;
        }),
      );
  }),
);
