import {
  type EnvironmentId,
  type PortfolioHeartbeat,
  type PortfolioHeartbeatsReadback,
  type PortfolioTask,
  type PortfolioTasksReadback,
  type PortfolioWishlist,
  type PortfolioWishlistsReadback,
  PortfolioHeartbeat as PortfolioHeartbeatSchema,
  PortfolioTask as PortfolioTaskSchema,
  PortfolioWishlist as PortfolioWishlistSchema,
  TrimmedNonEmptyString,
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
import { stopHeartbeatForTaskUnlink, stopHeartbeatForTerminalTask } from "./PortfolioTransitions.ts";

const TASKS_FILE = "portfolio-tasks.json";
const HEARTBEATS_FILE = "portfolio-heartbeats.json";
const WISHLISTS_FILE = "portfolio-wishlists.json";
const PersistedPortfolioTask = Schema.Struct({
  ...PortfolioTaskSchema.fields,
  ownerPassportId: Schema.optionalKey(Schema.NullOr(TrimmedNonEmptyString)),
  ownerHost: Schema.optionalKey(Schema.NullOr(TrimmedNonEmptyString)),
  assignment: Schema.optionalKey(Schema.Struct({
    ownerPassportId: PortfolioTaskSchema.fields.ownerPassportId,
    ownerHost: PortfolioTaskSchema.fields.ownerHost,
  })),
});
const decodePersistedTasks = Schema.decodeUnknownEffect(Schema.fromJsonString(Schema.Array(PersistedPortfolioTask)));
export const decodeTasks = Effect.fn("PortfolioOwner.decodeTasks")(function* (text: string) {
  const persisted = yield* decodePersistedTasks(text);
  const tasks = persisted.map(({ assignment, ...task }) => ({
    ...task,
    ownerPassportId: task.ownerPassportId === undefined ? (assignment?.ownerPassportId ?? null) : task.ownerPassportId,
    ownerHost: task.ownerHost === undefined ? (assignment?.ownerHost ?? null) : task.ownerHost,
  }));
  return yield* Schema.decodeUnknownEffect(Schema.Array(PortfolioTaskSchema))(tasks);
});
const decodeHeartbeats = Schema.decodeUnknownEffect(Schema.fromJsonString(Schema.Array(PortfolioHeartbeatSchema)));
const decodeWishlists = Schema.decodeUnknownEffect(Schema.fromJsonString(Schema.Array(PortfolioWishlistSchema)));
const encodeTasks = Schema.encodeEffect(Schema.fromJsonString(Schema.Array(PortfolioTaskSchema)));
const encodeHeartbeats = Schema.encodeEffect(Schema.fromJsonString(Schema.Array(PortfolioHeartbeatSchema)));
const encodeWishlists = Schema.encodeEffect(Schema.fromJsonString(Schema.Array(PortfolioWishlistSchema)));

export class PortfolioOwnerPersistenceError extends Schema.TaggedError<PortfolioOwnerPersistenceError>()(
  "PortfolioOwnerPersistenceError",
  { path: Schema.String, cause: Schema.Defect() },
) {}

export type PortfolioWriteDecision =
  | { readonly accepted: true }
  | { readonly accepted: false; readonly reason: "stale-revision" | "target-mismatch" | "task-not-found" };

function sameTarget(left: PortfolioTask["target"], right: PortfolioTask["target"]): boolean {
  return left.environmentId === right.environmentId && left.projectId === right.projectId && left.threadId === right.threadId;
}

export class PortfolioOwner extends Context.Service<PortfolioOwner, {
  readonly environmentId: EnvironmentId;
  readonly readTasks: Effect.Effect<PortfolioTasksReadback, PortfolioOwnerPersistenceError>;
  readonly readHeartbeats: Effect.Effect<PortfolioHeartbeatsReadback, PortfolioOwnerPersistenceError>;
  readonly readWishlists: Effect.Effect<PortfolioWishlistsReadback, PortfolioOwnerPersistenceError>;
  readonly writeTask: (input: { readonly expectedRevision: number | null; readonly task: PortfolioTask }) => Effect.Effect<PortfolioWriteDecision, PortfolioOwnerPersistenceError>;
  readonly writeHeartbeat: (input: { readonly expectedRevision: number | null; readonly heartbeat: PortfolioHeartbeat }) => Effect.Effect<PortfolioWriteDecision, PortfolioOwnerPersistenceError>;
  readonly writeWishlist: (input: { readonly expectedRevision: number | null; readonly wishlist: PortfolioWishlist }) => Effect.Effect<PortfolioWriteDecision, PortfolioOwnerPersistenceError>;
}>()("t3/portfolio/PortfolioOwner") {}

export const layer = Layer.effect(PortfolioOwner, Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const config = yield* ServerConfig.ServerConfig;
  const environment = yield* ServerEnvironment.ServerEnvironment;
  const environmentId = yield* environment.getEnvironmentId;
  const taskPath = path.join(config.stateDir, TASKS_FILE);
  const heartbeatPath = path.join(config.stateDir, HEARTBEATS_FILE);
  const wishlistPath = path.join(config.stateDir, WISHLISTS_FILE);
  const mutex = yield* Semaphore.make(1);

  const readFile = <A>(filePath: string, decode: (text: string) => Effect.Effect<A, unknown>, empty: A) =>
    fs.exists(filePath).pipe(
      Effect.flatMap((exists) => exists ? fs.readFileString(filePath).pipe(Effect.flatMap(decode)) : Effect.succeed(empty)),
      Effect.mapError((cause) => new PortfolioOwnerPersistenceError({ path: filePath, cause })),
    );
  const readTasks = readFile(taskPath, decodeTasks, [] as PortfolioTask[]).pipe(
    Effect.map((tasks) => ({ ownerEnvironmentId: environmentId, tasks })),
  );
  const readHeartbeats = readFile(heartbeatPath, decodeHeartbeats, [] as PortfolioHeartbeat[]).pipe(
    Effect.map((heartbeats) => ({ ownerEnvironmentId: environmentId, heartbeats })),
  );
  const readWishlists = readFile(wishlistPath, decodeWishlists, [] as PortfolioWishlist[]).pipe(
    Effect.map((wishlists) => ({ ownerEnvironmentId: environmentId, wishlists })),
  );
  const persist = <A>(filePath: string, records: A[], encode: (value: A[]) => Effect.Effect<string, unknown>) =>
    encode(records).pipe(
      Effect.flatMap((json) => writeFileStringAtomically({ filePath, contents: `${json}\n` }).pipe(
        Effect.provideService(FileSystem.FileSystem, fs),
        Effect.provideService(Path.Path, path),
      )),
      Effect.mapError((cause) => new PortfolioOwnerPersistenceError({ path: filePath, cause })),
    );

  const writeTask: PortfolioOwner["Service"]["writeTask"] = (input) => mutex.withPermits(1)(Effect.gen(function* () {
    const tasks = [...(yield* readTasks).tasks];
    const index = tasks.findIndex((task) => task.taskId === input.task.taskId);
    const current = tasks[index];
    if ((current?.revision ?? null) !== input.expectedRevision) return { accepted: false, reason: "stale-revision" } as const;
    if (current && !sameTarget(current.target, input.task.target)) return { accepted: false, reason: "target-mismatch" } as const;
    const next = { ...input.task, revision: (current?.revision ?? 0) + 1 };
    if (index < 0) tasks.push(next); else tasks[index] = next;
    yield* persist(taskPath, tasks, (records) => encodeTasks(records));
    if (current?.heartbeatId || next.heartbeatId) {
      const heartbeats = [...(yield* readHeartbeats).heartbeats];
      let changed = false;
      if (current?.heartbeatId && current.heartbeatId !== next.heartbeatId) {
        const oldIndex = heartbeats.findIndex((item) => item.heartbeatId === current.heartbeatId);
        const oldLinked = heartbeats[oldIndex];
        const stoppedOld = oldLinked ? stopHeartbeatForTaskUnlink(oldLinked, next.taskId, next.updatedAt) : null;
        if (stoppedOld) { heartbeats[oldIndex] = stoppedOld; changed = true; }
      }
      if (next.heartbeatId) {
        const heartbeatIndex = heartbeats.findIndex((item) => item.heartbeatId === next.heartbeatId);
        const linked = heartbeats[heartbeatIndex];
        const stopped = linked ? stopHeartbeatForTerminalTask(linked, next) : null;
        if (stopped) { heartbeats[heartbeatIndex] = stopped; changed = true; }
      }
      if (changed) {
        yield* persist(heartbeatPath, heartbeats, (records) => encodeHeartbeats(records));
      }
    }
    return { accepted: true } as const;
  }));

  const writeHeartbeat: PortfolioOwner["Service"]["writeHeartbeat"] = (input) => mutex.withPermits(1)(Effect.gen(function* () {
    const heartbeats = [...(yield* readHeartbeats).heartbeats];
    const index = heartbeats.findIndex((record) => record.heartbeatId === input.heartbeat.heartbeatId);
    const current = heartbeats[index];
    if ((current?.revision ?? null) !== input.expectedRevision) return { accepted: false, reason: "stale-revision" } as const;
    if (current && !sameTarget(current.target, input.heartbeat.target)) return { accepted: false, reason: "target-mismatch" } as const;
    const taskId = input.heartbeat.taskId;
    if (taskId !== null) {
      const task = (yield* readTasks).tasks.find((candidate) => candidate.taskId === taskId);
      if (!task) return { accepted: false, reason: "task-not-found" } as const;
      if (!sameTarget(task.target, input.heartbeat.target)) return { accepted: false, reason: "target-mismatch" } as const;
      if (task.heartbeatId !== input.heartbeat.heartbeatId) return { accepted: false, reason: "target-mismatch" } as const;
    }
    const next = { ...input.heartbeat, revision: (current?.revision ?? 0) + 1 };
    if (index < 0) heartbeats.push(next); else heartbeats[index] = next;
    yield* persist(heartbeatPath, heartbeats, (records) => encodeHeartbeats(records));
    return { accepted: true } as const;
  }));

  const writeWishlist: PortfolioOwner["Service"]["writeWishlist"] = (input) => mutex.withPermits(1)(Effect.gen(function* () {
    const wishlists = [...(yield* readWishlists).wishlists];
    const index = wishlists.findIndex((wishlist) => wishlist.wishlistId === input.wishlist.wishlistId);
    const current = wishlists[index];
    if ((current?.revision ?? null) !== input.expectedRevision) return { accepted: false, reason: "stale-revision" } as const;
    const next = { ...input.wishlist, revision: (current?.revision ?? 0) + 1 };
    if (index < 0) wishlists.push(next); else wishlists[index] = next;
    yield* persist(wishlistPath, wishlists, (records) => encodeWishlists(records));
    return { accepted: true } as const;
  }));

  return PortfolioOwner.of({ environmentId, readTasks, readHeartbeats, readWishlists, writeTask, writeHeartbeat, writeWishlist });
}));
