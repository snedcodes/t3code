import { assert, describe, it } from "@effect/vitest";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";

import {
  CommandId,
  ProjectId,
  RuntimeTaskId,
  ThreadId,
  type PortfolioTarget,
  type EnvironmentId,
} from "@t3tools/contracts";
import * as ServerConfig from "../config.ts";
import * as ServerEnvironment from "../environment/ServerEnvironment.ts";
import * as PortfolioHeartbeatOwner from "./PortfolioHeartbeatOwner.ts";
import * as PortfolioTaskOwner from "./PortfolioTaskOwner.ts";

const environmentLayer = (environmentId: EnvironmentId) =>
  Layer.succeed(
    ServerEnvironment.ServerEnvironment,
    ServerEnvironment.ServerEnvironment.of({
      getEnvironmentId: Effect.succeed(environmentId),
      getDescriptor: Effect.die("unused in PortfolioTaskOwner tests"),
    }),
  );

const ownerLayer = (baseDir: string, environmentId: EnvironmentId) =>
  PortfolioHeartbeatOwner.layer.pipe(
    Layer.provide(environmentLayer(environmentId)),
    Layer.provide(ServerConfig.ServerConfig.layerTest(process.cwd(), baseDir)),
    Layer.provide(NodeServices.layer),
  );

const taskLayer = (baseDir: string, environmentId: EnvironmentId) =>
  PortfolioTaskOwner.layer.pipe(
    Layer.provide(ownerLayer(baseDir, environmentId)),
    Layer.provide(environmentLayer(environmentId)),
    Layer.provide(ServerConfig.ServerConfig.layerTest(process.cwd(), baseDir)),
    Layer.provide(NodeServices.layer),
  );

const claimOwner = (baseDir: string, environmentId: EnvironmentId, target: PortfolioTarget) =>
  Effect.gen(function* () {
    const owner = yield* PortfolioHeartbeatOwner.PortfolioHeartbeatOwner;
    return yield* owner.claim({
      ownerEnvironmentId: environmentId,
      target,
      portfolioRevision: 1,
      heartbeatRevision: 1,
      portfolioChecksum: "portfolio-test",
      heartbeatChecksum: "heartbeat-test",
      updatedAt: "2026-08-24T00:00:00.000Z",
    });
  }).pipe(Effect.provide(ownerLayer(baseDir, environmentId)));

const readTasks = (baseDir: string, environmentId: EnvironmentId) =>
  Effect.gen(function* () {
    const owner = yield* PortfolioTaskOwner.PortfolioTaskOwner;
    return yield* owner.read;
  }).pipe(Effect.provide(taskLayer(baseDir, environmentId)));

const readWishlists = (baseDir: string, environmentId: EnvironmentId) =>
  Effect.gen(function* () {
    const owner = yield* PortfolioTaskOwner.PortfolioTaskOwner;
    return yield* owner.readWishlists;
  }).pipe(Effect.provide(taskLayer(baseDir, environmentId)));

const createTask = (
  baseDir: string,
  environmentId: EnvironmentId,
  ownerEnvironmentId: EnvironmentId,
  task: Parameters<PortfolioTaskOwner.PortfolioTaskOwner["Service"]["create"]>[0]["task"],
) =>
  Effect.gen(function* () {
    const owner = yield* PortfolioTaskOwner.PortfolioTaskOwner;
    return yield* owner.create({ ownerEnvironmentId, task });
  }).pipe(Effect.provide(taskLayer(baseDir, environmentId)));

const transitionTask = (
  baseDir: string,
  environmentId: EnvironmentId,
  ownerEnvironmentId: EnvironmentId,
  request: Parameters<
    PortfolioTaskOwner.PortfolioTaskOwner["Service"]["transitionStatus"]
  >[0]["request"],
) =>
  Effect.gen(function* () {
    const owner = yield* PortfolioTaskOwner.PortfolioTaskOwner;
    return yield* owner.transitionStatus({ ownerEnvironmentId, request });
  }).pipe(Effect.provide(taskLayer(baseDir, environmentId)));

const recordTaskReceipt = (
  baseDir: string,
  environmentId: EnvironmentId,
  ownerEnvironmentId: EnvironmentId,
  request: Parameters<
    PortfolioTaskOwner.PortfolioTaskOwner["Service"]["recordReceipt"]
  >[0]["request"],
) =>
  Effect.gen(function* () {
    const owner = yield* PortfolioTaskOwner.PortfolioTaskOwner;
    return yield* owner.recordReceipt({ ownerEnvironmentId, request });
  }).pipe(Effect.provide(taskLayer(baseDir, environmentId)));

const makeTask = (environmentId: EnvironmentId, taskId = "task-1") => ({
  taskId: RuntimeTaskId.make(taskId),
  title: "Persist one Task",
  outcome: "The canonical Task can be read back",
  target: {
    environmentId,
    projectId: ProjectId.make("project-tasks"),
    threadId: ThreadId.make("thread-tasks"),
  },
  status: "ready" as const,
  priority: "normal",
  assignment: { ownerPassportId: null, ownerHost: null },
  checklistItems: [],
  completionCondition: "The Task is visible in the owner list",
  planLinks: [],
  evidenceLinks: [],
  createdAt: "2026-08-24T00:00:00.000Z",
  updatedAt: "2026-08-24T00:00:00.000Z",
  completedAt: null,
  revision: 1,
  lastReceipt: null,
  heartbeatId: null,
});

describe("PortfolioTaskOwner", () => {
  it.effect("persists a Wishlist and promotes it once without changing source fields", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const baseDir = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "t3-portfolio-wishlist-owner-",
      });
      const environmentId = "vps" as EnvironmentId;
      const wishlist = {
        wishlistId: "wishlist-1",
        title: "Native Wishlist item",
        summary: "Promote this exact source into one Task",
        status: "idea" as const,
        priority: "normal",
        links: [],
        createdAt: "2026-08-24T00:00:00.000Z",
        updatedAt: "2026-08-24T00:00:00.000Z",
        revision: 1,
        promotedTaskId: null,
      };
      yield* claimOwner(baseDir, environmentId, makeTask(environmentId).target);
      assert.deepEqual(
        yield* Effect.gen(function* () {
          const service = yield* PortfolioTaskOwner.PortfolioTaskOwner;
          return yield* service.createWishlist({ ownerEnvironmentId: environmentId, wishlist });
        }).pipe(Effect.provide(taskLayer(baseDir, environmentId))),
        { accepted: true, reason: "accepted" },
      );
      assert.deepEqual((yield* readWishlists(baseDir, environmentId)).wishlists, [wishlist]);
      const promotedTaskId = RuntimeTaskId.make("task-from-wishlist");
      const promoted = yield* Effect.gen(function* () {
        const service = yield* PortfolioTaskOwner.PortfolioTaskOwner;
        return yield* service.promoteWishlist({
          ownerEnvironmentId: environmentId,
          request: {
            wishlistId: wishlist.wishlistId,
            expectedRevision: 1,
            promotedTaskId,
            updatedAt: "2026-08-24T00:03:00.000Z",
          },
        });
      }).pipe(Effect.provide(taskLayer(baseDir, environmentId)));
      assert.deepEqual(promoted, {
        accepted: true,
        wishlist: {
          ...wishlist,
          status: "promoted",
          updatedAt: "2026-08-24T00:03:00.000Z",
          revision: 2,
          promotedTaskId,
        },
      });
      assert.deepEqual(
        yield* Effect.gen(function* () {
          const service = yield* PortfolioTaskOwner.PortfolioTaskOwner;
          return yield* service.promoteWishlist({
            ownerEnvironmentId: environmentId,
            request: {
              wishlistId: wishlist.wishlistId,
              expectedRevision: 1,
              promotedTaskId,
              updatedAt: "2026-08-24T00:04:00.000Z",
            },
          });
        }).pipe(Effect.provide(taskLayer(baseDir, environmentId))),
        { accepted: false, reason: "already-promoted" },
      );
    }).pipe(Effect.provide(NodeServices.layer)),
  );
  it.effect("reads an empty ledger and persists one matching-owner Task idempotently", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const baseDir = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "t3-portfolio-task-owner-",
      });
      const environmentId = "vps" as EnvironmentId;
      const target = makeTask(environmentId).target;
      yield* claimOwner(baseDir, environmentId, target);

      assert.deepEqual((yield* readTasks(baseDir, environmentId)).tasks, []);
      const task = makeTask(environmentId);
      assert.deepEqual(yield* createTask(baseDir, environmentId, environmentId, task), {
        accepted: true,
        reason: "accepted",
      });
      assert.deepEqual(yield* createTask(baseDir, environmentId, environmentId, task), {
        accepted: true,
        reason: "already-recorded",
      });
      assert.deepEqual((yield* readTasks(baseDir, environmentId)).tasks, [task]);
    }).pipe(Effect.provide(NodeServices.layer)),
  );

  it.effect("persists a VPS-owned Task with an exact Mac target", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const baseDir = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "t3-portfolio-cross-environment-task-",
      });
      const ownerEnvironmentId = "vps" as EnvironmentId;
      const macEnvironmentId = "mac" as EnvironmentId;
      const task = makeTask(macEnvironmentId, "task-mac");
      yield* claimOwner(baseDir, ownerEnvironmentId, makeTask(ownerEnvironmentId).target);

      assert.deepEqual(yield* createTask(baseDir, ownerEnvironmentId, ownerEnvironmentId, task), {
        accepted: true,
        reason: "accepted",
      });
      assert.deepEqual((yield* readTasks(baseDir, ownerEnvironmentId)).tasks, [task]);
    }).pipe(Effect.provide(NodeServices.layer)),
  );

  it.effect("rejects non-owner writes without creating a ledger", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const baseDir = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "t3-portfolio-task-gating-",
      });
      const ownerEnvironmentId = "vps" as EnvironmentId;
      const otherEnvironmentId = "laptop" as EnvironmentId;
      yield* claimOwner(baseDir, ownerEnvironmentId, makeTask(ownerEnvironmentId).target);

      assert.deepEqual(
        yield* createTask(
          baseDir,
          otherEnvironmentId,
          ownerEnvironmentId,
          makeTask(otherEnvironmentId),
        ),
        { accepted: false, reason: "owner-unavailable" },
      );
      assert.equal(
        yield* fileSystem.exists(
          path.join(
            (yield* ServerConfig.deriveServerPaths(baseDir, undefined)).stateDir,
            "portfolio-tasks.json",
          ),
        ),
        false,
      );
    }).pipe(Effect.provide(NodeServices.layer)),
  );

  it.effect(
    "transitions a VPS-owned Mac-target Task and rejects missing, non-owner, target, and stale requests",
    () =>
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        const baseDir = yield* fileSystem.makeTempDirectoryScoped({
          prefix: "t3-portfolio-task-status-",
        });
        const ownerEnvironmentId = "vps" as EnvironmentId;
        const otherEnvironmentId = "laptop" as EnvironmentId;
        const task = makeTask("mac" as EnvironmentId);
        yield* claimOwner(baseDir, ownerEnvironmentId, makeTask(ownerEnvironmentId).target);
        yield* createTask(baseDir, ownerEnvironmentId, ownerEnvironmentId, task);

        const updatedAt = "2026-08-24T00:01:00.000Z";
        const success = yield* transitionTask(baseDir, ownerEnvironmentId, ownerEnvironmentId, {
          taskId: task.taskId,
          target: task.target,
          expectedRevision: 1,
          status: "in_progress",
          updatedAt,
        });
        assert.deepEqual(success, {
          accepted: true,
          task: { ...task, status: "in_progress", updatedAt, revision: 2 },
        });
        if (!success.accepted) throw new Error("Expected accepted Task status transition");
        assert.deepEqual((yield* readTasks(baseDir, ownerEnvironmentId)).tasks, [success.task]);

        assert.deepEqual(
          yield* transitionTask(baseDir, ownerEnvironmentId, ownerEnvironmentId, {
            taskId: RuntimeTaskId.make("missing-task"),
            target: task.target,
            expectedRevision: 1,
            status: "blocked",
            updatedAt,
          }),
          { accepted: false, reason: "task-not-found" },
        );
        assert.deepEqual(
          yield* transitionTask(baseDir, otherEnvironmentId, ownerEnvironmentId, {
            taskId: task.taskId,
            target: task.target,
            expectedRevision: 2,
            status: "blocked",
            updatedAt,
          }),
          { accepted: false, reason: "owner-unavailable" },
        );
        assert.deepEqual(
          yield* transitionTask(baseDir, ownerEnvironmentId, ownerEnvironmentId, {
            taskId: task.taskId,
            target: makeTask(otherEnvironmentId).target,
            expectedRevision: 2,
            status: "blocked",
            updatedAt,
          }),
          { accepted: false, reason: "target-mismatch" },
        );
        assert.deepEqual(
          yield* transitionTask(baseDir, ownerEnvironmentId, ownerEnvironmentId, {
            taskId: task.taskId,
            target: task.target,
            expectedRevision: 1,
            status: "blocked",
            updatedAt,
          }),
          { accepted: false, reason: "stale-revision" },
        );
        assert.deepEqual((yield* readTasks(baseDir, ownerEnvironmentId)).tasks, [success.task]);
        assert.equal(
          yield* fileSystem.exists(
            (yield* ServerConfig.deriveServerPaths(baseDir, undefined)).stateDir +
              "\\portfolio-tasks.json",
          ),
          true,
        );
      }).pipe(Effect.provide(NodeServices.layer)),
  );

  it.effect("persists a dispatched receipt only for the Task's exact target and revision", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const baseDir = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "t3-portfolio-task-receipt-",
      });
      const ownerEnvironmentId = "vps" as EnvironmentId;
      const otherEnvironmentId = "laptop" as EnvironmentId;
      const task = makeTask(ownerEnvironmentId);
      yield* claimOwner(baseDir, ownerEnvironmentId, task.target);
      yield* createTask(baseDir, ownerEnvironmentId, ownerEnvironmentId, task);
      const receipt = {
        commandId: CommandId.make("command-task-dispatch"),
        target: task.target,
        status: "dispatched" as const,
        sequence: 12,
        observedAt: "2026-08-24T00:02:00.000Z",
        detail: "Native Task dispatch accepted.",
      };

      const persisted = yield* recordTaskReceipt(baseDir, ownerEnvironmentId, ownerEnvironmentId, {
        taskId: task.taskId,
        target: task.target,
        expectedRevision: 1,
        receipt,
      });
      assert.deepEqual(persisted, {
        accepted: true,
        task: { ...task, updatedAt: receipt.observedAt, revision: 2, lastReceipt: receipt },
      });
      if (!persisted.accepted) throw new Error("Expected accepted Task receipt");
      assert.deepEqual((yield* readTasks(baseDir, ownerEnvironmentId)).tasks, [persisted.task]);

      assert.deepEqual(
        yield* recordTaskReceipt(baseDir, ownerEnvironmentId, ownerEnvironmentId, {
          taskId: task.taskId,
          target: makeTask(otherEnvironmentId).target,
          expectedRevision: 2,
          receipt: { ...receipt, target: makeTask(otherEnvironmentId).target },
        }),
        { accepted: false, reason: "target-mismatch" },
      );
    }).pipe(Effect.provide(NodeServices.layer)),
  );
});
