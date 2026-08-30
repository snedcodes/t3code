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
import * as PortfolioTaskOwner from "./PortfolioTaskOwner.ts";

export const portfolioHttpApiLayer = HttpApiBuilder.group(
  EnvironmentHttpApi,
  "portfolio",
  Effect.fnUntraced(function* (handlers) {
    const owner = yield* PortfolioHeartbeatOwner.PortfolioHeartbeatOwner;
    const tasks = yield* PortfolioTaskOwner.PortfolioTaskOwner;
    const environment = yield* ServerEnvironment.ServerEnvironment;
    return handlers
      .handle(
        "tasks",
        Effect.fn("environment.portfolio.tasks")(function* (args) {
          yield* annotateEnvironmentRequest(args.endpoint.name);
          yield* requireEnvironmentScope(AuthOrchestrationReadScope);
          return yield* tasks.read;
        }),
      )
      .handle(
        "createTask",
        Effect.fn("environment.portfolio.createTask")(function* (args) {
          yield* annotateEnvironmentRequest(args.endpoint.name);
          yield* requireEnvironmentScope(AuthOrchestrationOperateScope);
          const decision = yield* tasks
            .create({
              ownerEnvironmentId: yield* environment.getEnvironmentId,
              task: args.payload,
            })
            .pipe(
              Effect.catchTag("PortfolioTaskOwnerPersistenceError", (error) =>
                failEnvironmentInternal("internal_error", error),
              ),
            );
          if (!decision.accepted) {
            return yield* new EnvironmentHttpConflictError({
              message: `Task create rejected: ${decision.reason}.`,
            });
          }
          return yield* tasks.read;
        }),
      )
      .handle(
        "transitionTaskStatus",
        Effect.fn("environment.portfolio.transitionTaskStatus")(function* (args) {
          yield* annotateEnvironmentRequest(args.endpoint.name);
          yield* requireEnvironmentScope(AuthOrchestrationOperateScope);
          const decision = yield* tasks
            .transitionStatus({
              ownerEnvironmentId: yield* environment.getEnvironmentId,
              request: args.payload,
            })
            .pipe(
              Effect.catchTag("PortfolioTaskOwnerPersistenceError", (error) =>
                failEnvironmentInternal("internal_error", error),
              ),
            );
          if (!decision.accepted) {
            return yield* new EnvironmentHttpConflictError({
              message: `Task status transition rejected: ${decision.reason}.`,
            });
          }
          const readback = yield* tasks.read;
          return { owner: readback.owner, task: decision.task };
        }),
      )
      .handle(
        "recordTaskReceipt",
        Effect.fn("environment.portfolio.recordTaskReceipt")(function* (args) {
          yield* annotateEnvironmentRequest(args.endpoint.name);
          yield* requireEnvironmentScope(AuthOrchestrationOperateScope);
          const decision = yield* tasks
            .recordReceipt({
              ownerEnvironmentId: yield* environment.getEnvironmentId,
              request: args.payload,
            })
            .pipe(
              Effect.catchTag("PortfolioTaskOwnerPersistenceError", (error) =>
                failEnvironmentInternal("internal_error", error),
              ),
            );
          if (!decision.accepted) {
            return yield* new EnvironmentHttpConflictError({
              message: `Task receipt rejected: ${decision.reason}.`,
            });
          }
          const readback = yield* tasks.read;
          return { owner: readback.owner, task: decision.task };
        }),
      )
      .handle(
        "wishlists",
        Effect.fn("environment.portfolio.wishlists")(function* (args) {
          yield* annotateEnvironmentRequest(args.endpoint.name);
          yield* requireEnvironmentScope(AuthOrchestrationReadScope);
          return yield* tasks.readWishlists;
        }),
      )
      .handle(
        "createWishlist",
        Effect.fn("environment.portfolio.createWishlist")(function* (args) {
          yield* annotateEnvironmentRequest(args.endpoint.name);
          yield* requireEnvironmentScope(AuthOrchestrationOperateScope);
          const decision = yield* tasks
            .createWishlist({
              ownerEnvironmentId: yield* environment.getEnvironmentId,
              wishlist: args.payload,
            })
            .pipe(
              Effect.catchTag("PortfolioTaskOwnerPersistenceError", (error) =>
                failEnvironmentInternal("internal_error", error),
              ),
            );
          if (!decision.accepted)
            return yield* new EnvironmentHttpConflictError({
              message: `Wishlist create rejected: ${decision.reason}.`,
            });
          return yield* tasks.readWishlists;
        }),
      )
      .handle(
        "promoteWishlist",
        Effect.fn("environment.portfolio.promoteWishlist")(function* (args) {
          yield* annotateEnvironmentRequest(args.endpoint.name);
          yield* requireEnvironmentScope(AuthOrchestrationOperateScope);
          const decision = yield* tasks
            .promoteWishlist({
              ownerEnvironmentId: yield* environment.getEnvironmentId,
              request: args.payload,
            })
            .pipe(
              Effect.catchTag("PortfolioTaskOwnerPersistenceError", (error) =>
                failEnvironmentInternal("internal_error", error),
              ),
            );
          if (!decision.accepted)
            return yield* new EnvironmentHttpConflictError({
              message: `Wishlist promotion rejected: ${decision.reason}.`,
            });
          const readback = yield* tasks.readWishlists;
          return { owner: readback.owner, wishlist: decision.wishlist };
        }),
      )
      .handle(
        "heartbeatOwner",
        Effect.fn("environment.portfolio.heartbeatOwner")(function* (args) {
          yield* annotateEnvironmentRequest(args.endpoint.name);
          yield* requireEnvironmentScope(AuthOrchestrationReadScope);
          return yield* owner.read;
        }),
      )
      .handle(
        "heartbeatRecords",
        Effect.fn("environment.portfolio.heartbeatRecords")(function* (args) {
          yield* annotateEnvironmentRequest(args.endpoint.name);
          yield* requireEnvironmentScope(AuthOrchestrationReadScope);
          return yield* owner.readRecords;
        }),
      )
      .handle(
        "heartbeatRecord",
        Effect.fn("environment.portfolio.heartbeatRecord")(function* (args) {
          yield* annotateEnvironmentRequest(args.endpoint.name);
          yield* requireEnvironmentScope(AuthOrchestrationReadScope);
          return yield* owner.readRecord(args.params.heartbeatId);
        }),
      )
      .handle(
        "upsertHeartbeatRecord",
        Effect.fn("environment.portfolio.upsertHeartbeatRecord")(function* (args) {
          yield* annotateEnvironmentRequest(args.endpoint.name);
          yield* requireEnvironmentScope(AuthOrchestrationOperateScope);
          const decision = yield* owner
            .upsertRecord({
              ownerEnvironmentId: yield* environment.getEnvironmentId,
              record: args.payload,
            })
            .pipe(
              Effect.catchTag("PortfolioHeartbeatOwnerPersistenceError", (error) =>
                failEnvironmentInternal("internal_error", error),
              ),
            );
          if (!decision.accepted) {
            return yield* new EnvironmentHttpConflictError({
              message: `Heartbeat record rejected: ${decision.reason}.`,
            });
          }
          return yield* owner.readRecords;
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
