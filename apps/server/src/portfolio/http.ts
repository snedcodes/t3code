import {
  AuthOrchestrationOperateScope,
  AuthOrchestrationReadScope,
  EnvironmentHttpApi,
  EnvironmentHttpConflictError,
} from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";

import { annotateEnvironmentRequest, failEnvironmentInternal, requireEnvironmentScope } from "../auth/http.ts";
import * as PortfolioOwner from "./PortfolioOwner.ts";

export const portfolioHttpApiLayer = HttpApiBuilder.group(
  EnvironmentHttpApi,
  "portfolio",
  Effect.fnUntraced(function* (handlers) {
    const owner = yield* PortfolioOwner.PortfolioOwner;
    const readTasks = owner.readTasks.pipe(
      Effect.catchTag("PortfolioOwnerPersistenceError", (error) => failEnvironmentInternal("internal_error", error)),
    );
    const readHeartbeats = owner.readHeartbeats.pipe(
      Effect.catchTag("PortfolioOwnerPersistenceError", (error) => failEnvironmentInternal("internal_error", error)),
    );
    const readWishlists = owner.readWishlists.pipe(
      Effect.catchTag("PortfolioOwnerPersistenceError", (error) => failEnvironmentInternal("internal_error", error)),
    );
    return handlers
      .handle("tasks", Effect.fn("environment.portfolio.tasks")(function* (args) {
        yield* annotateEnvironmentRequest(args.endpoint.name);
        yield* requireEnvironmentScope(AuthOrchestrationReadScope);
        return yield* readTasks;
      }))
      .handle("writeTask", Effect.fn("environment.portfolio.writeTask")(function* (args) {
        yield* annotateEnvironmentRequest(args.endpoint.name);
        yield* requireEnvironmentScope(AuthOrchestrationOperateScope);
        const result = yield* owner.writeTask(args.payload).pipe(
          Effect.catchTag("PortfolioOwnerPersistenceError", (error) => failEnvironmentInternal("internal_error", error)),
        );
        if (!result.accepted) return yield* new EnvironmentHttpConflictError({ message: `Task write rejected: ${result.reason}.` });
        return yield* readTasks;
      }))
      .handle("heartbeats", Effect.fn("environment.portfolio.heartbeats")(function* (args) {
        yield* annotateEnvironmentRequest(args.endpoint.name);
        yield* requireEnvironmentScope(AuthOrchestrationReadScope);
        return yield* readHeartbeats;
      }))
      .handle("writeHeartbeat", Effect.fn("environment.portfolio.writeHeartbeat")(function* (args) {
        yield* annotateEnvironmentRequest(args.endpoint.name);
        yield* requireEnvironmentScope(AuthOrchestrationOperateScope);
        const result = yield* owner.writeHeartbeat(args.payload).pipe(
          Effect.catchTag("PortfolioOwnerPersistenceError", (error) => failEnvironmentInternal("internal_error", error)),
        );
        if (!result.accepted) return yield* new EnvironmentHttpConflictError({ message: `Heartbeat write rejected: ${result.reason}.` });
        return yield* readHeartbeats;
      }))
      .handle("wishlists", Effect.fn("environment.portfolio.wishlists")(function* (args) {
        yield* annotateEnvironmentRequest(args.endpoint.name);
        yield* requireEnvironmentScope(AuthOrchestrationReadScope);
        return yield* readWishlists;
      }))
      .handle("writeWishlist", Effect.fn("environment.portfolio.writeWishlist")(function* (args) {
        yield* annotateEnvironmentRequest(args.endpoint.name);
        yield* requireEnvironmentScope(AuthOrchestrationOperateScope);
        const result = yield* owner.writeWishlist(args.payload).pipe(
          Effect.catchTag("PortfolioOwnerPersistenceError", (error) => failEnvironmentInternal("internal_error", error)),
        );
        if (!result.accepted) return yield* new EnvironmentHttpConflictError({ message: `Wishlist write rejected: ${result.reason}.` });
        return yield* readWishlists;
      }));
  }),
);
