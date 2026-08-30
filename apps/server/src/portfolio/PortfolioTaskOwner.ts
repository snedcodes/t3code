import {
  EnvironmentId,
  PortfolioTask,
  PortfolioTaskCreateRequest,
  PortfolioTaskReceiptRecordRequest,
  PortfolioTaskStatusTransitionRequest,
  PortfolioTasksReadback,
  PortfolioWishlist,
  PortfolioWishlistCreateRequest,
  PortfolioWishlistPromotionRequest,
  PortfolioWishlistsReadback,
} from "@t3tools/contracts";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";
import * as Semaphore from "effect/Semaphore";

import { writeFileStringAtomically } from "../atomicWrite.ts";
import * as ServerConfig from "../config.ts";
import * as ServerEnvironment from "../environment/ServerEnvironment.ts";
import * as PortfolioHeartbeatOwner from "./PortfolioHeartbeatOwner.ts";

const TASKS_FILE = "portfolio-tasks.json";
const WISHLISTS_FILE = "portfolio-wishlists.json";

const decodeTasks = Schema.decodeUnknownEffect(Schema.fromJsonString(Schema.Array(PortfolioTask)));
const encodeTasks = Schema.encodeEffect(Schema.fromJsonString(Schema.Array(PortfolioTask)));
const decodeWishlists = Schema.decodeUnknownEffect(
  Schema.fromJsonString(Schema.Array(PortfolioWishlist)),
);
const encodeWishlists = Schema.encodeEffect(Schema.fromJsonString(Schema.Array(PortfolioWishlist)));

export class PortfolioTaskOwnerPersistenceError extends Schema.TaggedErrorClass<PortfolioTaskOwnerPersistenceError>()(
  "PortfolioTaskOwnerPersistenceError",
  { ownerPath: Schema.String, cause: Schema.Defect() },
) {}

export type PortfolioTaskCreateDecision =
  | { readonly accepted: true; readonly reason: "accepted" | "already-recorded" }
  | {
      readonly accepted: false;
      readonly reason: "owner-unavailable" | "different-owner" | "target-mismatch";
    };

export type PortfolioTaskStatusTransitionDecision =
  | { readonly accepted: true; readonly task: PortfolioTask }
  | {
      readonly accepted: false;
      readonly reason:
        | "owner-unavailable"
        | "different-owner"
        | "target-mismatch"
        | "task-not-found"
        | "stale-revision";
    };

export type PortfolioTaskReceiptRecordDecision =
  | { readonly accepted: true; readonly task: PortfolioTask }
  | {
      readonly accepted: false;
      readonly reason:
        | "owner-unavailable"
        | "different-owner"
        | "target-mismatch"
        | "task-not-found"
        | "stale-revision";
    };

export type PortfolioWishlistCreateDecision =
  | { readonly accepted: true; readonly reason: "accepted" | "already-recorded" }
  | { readonly accepted: false; readonly reason: "owner-unavailable" | "different-owner" };
export type PortfolioWishlistPromotionDecision =
  | { readonly accepted: true; readonly wishlist: PortfolioWishlist }
  | {
      readonly accepted: false;
      readonly reason:
        | "owner-unavailable"
        | "different-owner"
        | "wishlist-not-found"
        | "stale-revision"
        | "already-promoted";
    };

function sameTarget(left: PortfolioTask["target"], right: PortfolioTask["target"]): boolean {
  return (
    left.environmentId === right.environmentId &&
    left.projectId === right.projectId &&
    left.threadId === right.threadId
  );
}

export class PortfolioTaskOwner extends Context.Service<
  PortfolioTaskOwner,
  {
    readonly read: Effect.Effect<PortfolioTasksReadback>;
    readonly create: (input: {
      readonly ownerEnvironmentId: EnvironmentId;
      readonly task: PortfolioTaskCreateRequest;
    }) => Effect.Effect<PortfolioTaskCreateDecision, PortfolioTaskOwnerPersistenceError>;
    readonly transitionStatus: (input: {
      readonly ownerEnvironmentId: EnvironmentId;
      readonly request: PortfolioTaskStatusTransitionRequest;
    }) => Effect.Effect<PortfolioTaskStatusTransitionDecision, PortfolioTaskOwnerPersistenceError>;
    readonly recordReceipt: (input: {
      readonly ownerEnvironmentId: EnvironmentId;
      readonly request: PortfolioTaskReceiptRecordRequest;
    }) => Effect.Effect<PortfolioTaskReceiptRecordDecision, PortfolioTaskOwnerPersistenceError>;
    readonly readWishlists: Effect.Effect<PortfolioWishlistsReadback>;
    readonly createWishlist: (input: {
      readonly ownerEnvironmentId: EnvironmentId;
      readonly wishlist: PortfolioWishlistCreateRequest;
    }) => Effect.Effect<PortfolioWishlistCreateDecision, PortfolioTaskOwnerPersistenceError>;
    readonly promoteWishlist: (input: {
      readonly ownerEnvironmentId: EnvironmentId;
      readonly request: PortfolioWishlistPromotionRequest;
    }) => Effect.Effect<PortfolioWishlistPromotionDecision, PortfolioTaskOwnerPersistenceError>;
  }
>()("t3/portfolio/PortfolioTaskOwner") {}

export const make = Effect.gen(function* () {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const config = yield* ServerConfig.ServerConfig;
  const environment = yield* ServerEnvironment.ServerEnvironment;
  const heartbeatOwner = yield* PortfolioHeartbeatOwner.PortfolioHeartbeatOwner;
  const tasksPath = path.join(config.stateDir, TASKS_FILE);
  const wishlistsPath = path.join(config.stateDir, WISHLISTS_FILE);
  const mutex = yield* Semaphore.make(1);

  const readTasks = fileSystem.readFileString(tasksPath).pipe(
    Effect.flatMap((raw) => decodeTasks(raw)),
    Effect.orElseSucceed(() => []),
  );
  const readWishlistRecords = fileSystem.readFileString(wishlistsPath).pipe(
    Effect.flatMap((raw) => decodeWishlists(raw)),
    Effect.orElseSucceed(() => []),
  );

  const unavailableReadback: PortfolioTasksReadback = {
    owner: { role: "owner_unavailable", freshness: "unknown", descriptor: null },
    tasks: [],
  };

  const read: PortfolioTaskOwner["Service"]["read"] = Effect.gen(function* () {
    const owner = yield* heartbeatOwner.read;
    if (owner.role !== "owner") return { owner, tasks: [] } satisfies PortfolioTasksReadback;
    return { owner, tasks: yield* readTasks } satisfies PortfolioTasksReadback;
  }).pipe(Effect.orElseSucceed(() => unavailableReadback));

  const unavailableWishlists: PortfolioWishlistsReadback = {
    owner: { role: "owner_unavailable", freshness: "unknown", descriptor: null },
    wishlists: [],
  };
  const readWishlists: PortfolioTaskOwner["Service"]["readWishlists"] = Effect.gen(function* () {
    const owner = yield* heartbeatOwner.read;
    if (owner.role !== "owner")
      return { owner, wishlists: [] } satisfies PortfolioWishlistsReadback;
    return { owner, wishlists: yield* readWishlistRecords } satisfies PortfolioWishlistsReadback;
  }).pipe(Effect.orElseSucceed(() => unavailableWishlists));

  const create: PortfolioTaskOwner["Service"]["create"] = (input) =>
    mutex
      .withPermits(1)(
        Effect.gen(function* () {
          const owner = yield* heartbeatOwner.read;
          const environmentId = yield* environment.getEnvironmentId;
          if (owner.role !== "owner")
            return { accepted: false, reason: "owner-unavailable" } as const;
          if (input.ownerEnvironmentId !== environmentId)
            return { accepted: false, reason: "different-owner" } as const;

          const tasks = [...(yield* readTasks)];
          if (tasks.some((task) => task.taskId === input.task.taskId))
            return { accepted: true, reason: "already-recorded" } as const;
          tasks.push(input.task);
          const encoded = yield* encodeTasks(tasks);
          yield* writeFileStringAtomically({ filePath: tasksPath, contents: `${encoded}\n` }).pipe(
            Effect.provideService(FileSystem.FileSystem, fileSystem),
            Effect.provideService(Path.Path, path),
          );
          return { accepted: true, reason: "accepted" } as const;
        }),
      )
      .pipe(
        Effect.mapError(
          (cause) => new PortfolioTaskOwnerPersistenceError({ ownerPath: tasksPath, cause }),
        ),
      );

  const transitionStatus: PortfolioTaskOwner["Service"]["transitionStatus"] = (input) =>
    mutex
      .withPermits(1)(
        Effect.gen(function* () {
          const owner = yield* heartbeatOwner.read;
          const environmentId = yield* environment.getEnvironmentId;
          if (owner.role !== "owner")
            return { accepted: false, reason: "owner-unavailable" } as const;
          if (input.ownerEnvironmentId !== environmentId)
            return { accepted: false, reason: "different-owner" } as const;
          const tasks = [...(yield* readTasks)];
          const index = tasks.findIndex((task) => task.taskId === input.request.taskId);
          if (index < 0) return { accepted: false, reason: "task-not-found" } as const;
          const current = tasks[index];
          if (current === undefined) return { accepted: false, reason: "task-not-found" } as const;
          if (!sameTarget(current.target, input.request.target))
            return { accepted: false, reason: "target-mismatch" } as const;
          if (input.request.expectedRevision !== current.revision)
            return { accepted: false, reason: "stale-revision" } as const;

          const updated: PortfolioTask = {
            ...current,
            status: input.request.status,
            updatedAt: input.request.updatedAt,
            revision: current.revision + 1,
          };
          tasks[index] = updated;
          const encoded = yield* encodeTasks(tasks);
          yield* writeFileStringAtomically({ filePath: tasksPath, contents: `${encoded}\n` }).pipe(
            Effect.provideService(FileSystem.FileSystem, fileSystem),
            Effect.provideService(Path.Path, path),
          );
          if (
            current.heartbeatId !== null &&
            (input.request.status === "complete" ||
              input.request.status === "blocked" ||
              input.request.status === "cancelled")
          ) {
            const linked = yield* heartbeatOwner.readRecord(String(current.heartbeatId));
            if (linked.record !== null) {
              yield* heartbeatOwner.upsertRecord({
                ownerEnvironmentId: environmentId,
                record: {
                  ...linked.record,
                  status:
                    input.request.status === "complete"
                      ? "completed"
                      : input.request.status === "blocked"
                        ? "blocked"
                        : "stopped",
                  pauseReason: null,
                  stopReason:
                    input.request.status === "complete"
                      ? "Linked Task completed."
                      : input.request.status === "blocked"
                        ? "Linked Task blocked."
                        : "Linked Task cancelled.",
                  updatedAt: input.request.updatedAt,
                },
              });
            }
          }
          return { accepted: true, task: updated } as const;
        }),
      )
      .pipe(
        Effect.mapError(
          (cause) => new PortfolioTaskOwnerPersistenceError({ ownerPath: tasksPath, cause }),
        ),
      );

  const recordReceipt: PortfolioTaskOwner["Service"]["recordReceipt"] = (input) =>
    mutex
      .withPermits(1)(
        Effect.gen(function* () {
          const owner = yield* heartbeatOwner.read;
          const environmentId = yield* environment.getEnvironmentId;
          if (owner.role !== "owner")
            return { accepted: false, reason: "owner-unavailable" } as const;
          if (input.ownerEnvironmentId !== environmentId)
            return { accepted: false, reason: "different-owner" } as const;
          if (input.request.target.environmentId !== environmentId)
            return { accepted: false, reason: "target-mismatch" } as const;
          if (!sameTarget(input.request.target, input.request.receipt.target)) {
            return { accepted: false, reason: "target-mismatch" } as const;
          }

          const tasks = [...(yield* readTasks)];
          const index = tasks.findIndex((task) => task.taskId === input.request.taskId);
          if (index < 0) return { accepted: false, reason: "task-not-found" } as const;
          const current = tasks[index];
          if (current === undefined) return { accepted: false, reason: "task-not-found" } as const;
          if (!sameTarget(current.target, input.request.target))
            return { accepted: false, reason: "target-mismatch" } as const;
          if (input.request.expectedRevision !== current.revision)
            return { accepted: false, reason: "stale-revision" } as const;

          const updated: PortfolioTask = {
            ...current,
            updatedAt: input.request.receipt.observedAt,
            revision: current.revision + 1,
            lastReceipt: input.request.receipt,
          };
          tasks[index] = updated;
          const encoded = yield* encodeTasks(tasks);
          yield* writeFileStringAtomically({ filePath: tasksPath, contents: `${encoded}\n` }).pipe(
            Effect.provideService(FileSystem.FileSystem, fileSystem),
            Effect.provideService(Path.Path, path),
          );
          return { accepted: true, task: updated } as const;
        }),
      )
      .pipe(
        Effect.mapError(
          (cause) => new PortfolioTaskOwnerPersistenceError({ ownerPath: tasksPath, cause }),
        ),
      );

  const createWishlist: PortfolioTaskOwner["Service"]["createWishlist"] = (input) =>
    mutex
      .withPermits(1)(
        Effect.gen(function* () {
          const owner = yield* heartbeatOwner.read;
          const environmentId = yield* environment.getEnvironmentId;
          if (owner.role !== "owner")
            return { accepted: false, reason: "owner-unavailable" } as const;
          if (input.ownerEnvironmentId !== environmentId)
            return { accepted: false, reason: "different-owner" } as const;
          const wishlists = [...(yield* readWishlistRecords)];
          if (wishlists.some((wishlist) => wishlist.wishlistId === input.wishlist.wishlistId)) {
            return { accepted: true, reason: "already-recorded" } as const;
          }
          wishlists.push(input.wishlist);
          const encoded = yield* encodeWishlists(wishlists);
          yield* writeFileStringAtomically({
            filePath: wishlistsPath,
            contents: `${encoded}\n`,
          }).pipe(
            Effect.provideService(FileSystem.FileSystem, fileSystem),
            Effect.provideService(Path.Path, path),
          );
          return { accepted: true, reason: "accepted" } as const;
        }),
      )
      .pipe(
        Effect.mapError(
          (cause) => new PortfolioTaskOwnerPersistenceError({ ownerPath: wishlistsPath, cause }),
        ),
      );

  const promoteWishlist: PortfolioTaskOwner["Service"]["promoteWishlist"] = (input) =>
    mutex
      .withPermits(1)(
        Effect.gen(function* () {
          const owner = yield* heartbeatOwner.read;
          const environmentId = yield* environment.getEnvironmentId;
          if (owner.role !== "owner")
            return { accepted: false, reason: "owner-unavailable" } as const;
          if (input.ownerEnvironmentId !== environmentId)
            return { accepted: false, reason: "different-owner" } as const;
          const wishlists = [...(yield* readWishlistRecords)];
          const index = wishlists.findIndex(
            (wishlist) => wishlist.wishlistId === input.request.wishlistId,
          );
          if (index < 0) return { accepted: false, reason: "wishlist-not-found" } as const;
          const current = wishlists[index];
          if (current === undefined)
            return { accepted: false, reason: "wishlist-not-found" } as const;
          if (current.promotedTaskId !== null)
            return { accepted: false, reason: "already-promoted" } as const;
          if (current.revision !== input.request.expectedRevision)
            return { accepted: false, reason: "stale-revision" } as const;
          const updated: PortfolioWishlist = {
            ...current,
            status: "promoted",
            updatedAt: input.request.updatedAt,
            revision: current.revision + 1,
            promotedTaskId: input.request.promotedTaskId,
          };
          wishlists[index] = updated;
          const encoded = yield* encodeWishlists(wishlists);
          yield* writeFileStringAtomically({
            filePath: wishlistsPath,
            contents: `${encoded}\n`,
          }).pipe(
            Effect.provideService(FileSystem.FileSystem, fileSystem),
            Effect.provideService(Path.Path, path),
          );
          return { accepted: true, wishlist: updated } as const;
        }),
      )
      .pipe(
        Effect.mapError(
          (cause) => new PortfolioTaskOwnerPersistenceError({ ownerPath: wishlistsPath, cause }),
        ),
      );

  return PortfolioTaskOwner.of({
    read,
    create,
    transitionStatus,
    recordReceipt,
    readWishlists,
    createWishlist,
    promoteWishlist,
  });
});

export const layer = Layer.effect(PortfolioTaskOwner, make);
