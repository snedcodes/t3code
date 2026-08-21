import { assert, describe, it } from "@effect/vitest";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";

import { CommandId, ProjectId, ThreadId, type EnvironmentId } from "@t3tools/contracts";
import * as ServerConfig from "../config.ts";
import * as ServerEnvironment from "../environment/ServerEnvironment.ts";
import * as PortfolioHeartbeatOwner from "./PortfolioHeartbeatOwner.ts";

const environmentLayer = (environmentId: EnvironmentId) =>
  Layer.succeed(
    ServerEnvironment.ServerEnvironment,
    ServerEnvironment.ServerEnvironment.of({
      getEnvironmentId: Effect.succeed(environmentId),
      getDescriptor: Effect.die("unused in PortfolioHeartbeatOwner tests"),
    }),
  );

const testLayer = (baseDir: string, environmentId: EnvironmentId) =>
  PortfolioHeartbeatOwner.layer.pipe(
    Layer.provide(environmentLayer(environmentId)),
    Layer.provide(ServerConfig.ServerConfig.layerTest(process.cwd(), baseDir)),
    Layer.provide(NodeServices.layer),
  );

const readOwner = (baseDir: string, environmentId: EnvironmentId) =>
  Effect.gen(function* () {
    const owner = yield* PortfolioHeartbeatOwner.PortfolioHeartbeatOwner;
    return yield* owner.read;
  }).pipe(Effect.provide(testLayer(baseDir, environmentId)));

const claimOwner = (
  baseDir: string,
  environmentId: EnvironmentId,
  input: Parameters<PortfolioHeartbeatOwner.PortfolioHeartbeatOwner["Service"]["claim"]>[0],
) =>
  Effect.gen(function* () {
    const owner = yield* PortfolioHeartbeatOwner.PortfolioHeartbeatOwner;
    return yield* owner.claim(input);
  }).pipe(Effect.provide(testLayer(baseDir, environmentId)));

const recordReceipt = (
  baseDir: string,
  environmentId: EnvironmentId,
  input: Parameters<PortfolioHeartbeatOwner.PortfolioHeartbeatOwner["Service"]["recordReceipt"]>[0],
) =>
  Effect.gen(function* () {
    const owner = yield* PortfolioHeartbeatOwner.PortfolioHeartbeatOwner;
    return yield* owner.recordReceipt(input);
  }).pipe(Effect.provide(testLayer(baseDir, environmentId)));

const prepareTransfer = (
  baseDir: string,
  environmentId: EnvironmentId,
  input: Parameters<
    PortfolioHeartbeatOwner.PortfolioHeartbeatOwner["Service"]["prepareTransfer"]
  >[0],
) =>
  Effect.gen(function* () {
    const owner = yield* PortfolioHeartbeatOwner.PortfolioHeartbeatOwner;
    return yield* owner.prepareTransfer(input);
  }).pipe(Effect.provide(testLayer(baseDir, environmentId)));

const acceptTransfer = (
  baseDir: string,
  environmentId: EnvironmentId,
  input: Parameters<
    PortfolioHeartbeatOwner.PortfolioHeartbeatOwner["Service"]["acceptTransfer"]
  >[0],
) =>
  Effect.gen(function* () {
    const owner = yield* PortfolioHeartbeatOwner.PortfolioHeartbeatOwner;
    return yield* owner.acceptTransfer(input);
  }).pipe(Effect.provide(testLayer(baseDir, environmentId)));

const finalizeTransfer = (
  baseDir: string,
  environmentId: EnvironmentId,
  input: Parameters<
    PortfolioHeartbeatOwner.PortfolioHeartbeatOwner["Service"]["finalizeTransfer"]
  >[0],
) =>
  Effect.gen(function* () {
    const owner = yield* PortfolioHeartbeatOwner.PortfolioHeartbeatOwner;
    return yield* owner.finalizeTransfer(input);
  }).pipe(Effect.provide(testLayer(baseDir, environmentId)));

describe("PortfolioHeartbeatOwner", () => {
  it.effect("reports owner unavailable without inventing local state", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const baseDir = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "t3-portfolio-heartbeat-owner-test-",
      });

      assert.deepEqual(yield* readOwner(baseDir, "mac" as EnvironmentId), {
        role: "owner_unavailable",
        freshness: "unknown",
        descriptor: null,
      });
    }).pipe(Effect.provide(NodeServices.layer)),
  );

  it.effect("decodes an owner descriptor and identifies the local owner", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const baseDir = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "t3-portfolio-heartbeat-owner-test-",
      });
      const config = yield* ServerConfig.deriveServerPaths(baseDir, undefined);
      yield* fileSystem.makeDirectory(config.stateDir, { recursive: true });
      const descriptor = {
        schemaVersion: "1",
        domain: "portfolio_heartbeat" as const,
        ownerEnvironmentId: "mac" as EnvironmentId,
        ownerEpoch: 1,
        portfolioRevision: 2,
        heartbeatRevision: 3,
        portfolioChecksum: "portfolio-sha",
        heartbeatChecksum: "heartbeat-sha",
        updatedAt: DateTime.formatIso(yield* DateTime.now),
        target: null,
        lastReceipt: null,
      };
      yield* fileSystem.writeFileString(
        path.join(config.stateDir, "portfolio-heartbeat-owner.json"),
        `{"schemaVersion":"1","domain":"portfolio_heartbeat","ownerEnvironmentId":"mac","ownerEpoch":1,"portfolioRevision":2,"heartbeatRevision":3,"portfolioChecksum":"portfolio-sha","heartbeatChecksum":"heartbeat-sha","updatedAt":"${descriptor.updatedAt}","target":null,"lastReceipt":null}`,
      );

      const result = yield* readOwner(baseDir, "mac" as EnvironmentId);
      assert.equal(result.role, "owner");
      assert.equal(result.freshness, "fresh");
      assert.deepEqual(result.descriptor, descriptor);
    }).pipe(Effect.provide(NodeServices.layer)),
  );

  it.effect("returns owner unavailable for malformed descriptors", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const baseDir = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "t3-portfolio-heartbeat-owner-test-",
      });
      const config = yield* ServerConfig.deriveServerPaths(baseDir, undefined);
      const ownerPath = path.join(config.stateDir, "portfolio-heartbeat-owner.json");
      yield* fileSystem.makeDirectory(config.stateDir, { recursive: true });

      yield* fileSystem.writeFileString(ownerPath, "not-json");
      assert.equal((yield* readOwner(baseDir, "mac" as EnvironmentId)).role, "owner_unavailable");

      yield* fileSystem.writeFileString(ownerPath, '{"domain":"portfolio_heartbeat"}');
      assert.equal((yield* readOwner(baseDir, "mac" as EnvironmentId)).role, "owner_unavailable");
    }).pipe(Effect.provide(NodeServices.layer)),
  );

  it.effect("persists an initial claim and makes a matching claim idempotent", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const baseDir = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "t3-portfolio-heartbeat-owner-claim-test-",
      });
      const environmentId = "mac" as EnvironmentId;
      const input = {
        ownerEnvironmentId: environmentId,
        target: {
          environmentId,
          projectId: ProjectId.make("project-portfolio"),
          threadId: ThreadId.make("thread-heartbeat"),
        },
        portfolioRevision: 2,
        heartbeatRevision: 3,
        portfolioChecksum: "portfolio-sha",
        heartbeatChecksum: "heartbeat-sha",
        updatedAt: "2026-08-19T06:00:00.000Z",
      };

      const first = yield* claimOwner(baseDir, environmentId, input);
      assert.deepEqual(first, {
        accepted: true,
        reason: "accepted",
        descriptor: {
          schemaVersion: "1",
          domain: "portfolio_heartbeat",
          ownerEnvironmentId: environmentId,
          ownerEpoch: 0,
          portfolioRevision: 2,
          heartbeatRevision: 3,
          portfolioChecksum: "portfolio-sha",
          heartbeatChecksum: "heartbeat-sha",
          updatedAt: "2026-08-19T06:00:00.000Z",
          target: input.target,
          lastReceipt: null,
        },
      });
      assert.equal((yield* readOwner(baseDir, environmentId)).role, "owner");

      const repeat = yield* claimOwner(baseDir, environmentId, input);
      assert.deepEqual(repeat, {
        accepted: true,
        reason: "already-owner",
        descriptor: first.descriptor,
      });
    }).pipe(Effect.provide(NodeServices.layer)),
  );

  it.effect("persists owner receipts without allowing stale or mismatched updates", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const baseDir = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "t3-portfolio-heartbeat-owner-receipt-test-",
      });
      const environmentId = "mac" as EnvironmentId;
      const target = {
        environmentId,
        projectId: ProjectId.make("project-portfolio"),
        threadId: ThreadId.make("thread-heartbeat"),
      };
      yield* claimOwner(baseDir, environmentId, {
        ownerEnvironmentId: environmentId,
        target,
        portfolioRevision: 2,
        heartbeatRevision: 3,
        portfolioChecksum: "portfolio-sha",
        heartbeatChecksum: "heartbeat-sha",
        updatedAt: "2026-08-19T06:00:00.000Z",
      });

      const receipt = {
        commandId: CommandId.make("heartbeat-command-1"),
        target,
        status: "transcript-confirmed" as const,
        sequence: 7,
        observedAt: "2026-08-19T06:01:00.000Z",
        detail: "Bounded proof confirmed.",
      };
      assert.deepEqual(
        yield* recordReceipt(baseDir, environmentId, {
          ownerEnvironmentId: environmentId,
          receipt,
          updatedAt: "2026-08-19T06:01:01.000Z",
        }),
        { accepted: true, reason: "accepted" },
      );
      assert.deepEqual((yield* readOwner(baseDir, environmentId)).descriptor?.lastReceipt, receipt);

      assert.deepEqual(
        yield* recordReceipt(baseDir, environmentId, {
          ownerEnvironmentId: environmentId,
          receipt,
          updatedAt: "2026-08-19T06:01:02.000Z",
        }),
        { accepted: true, reason: "already-recorded" },
      );

      assert.deepEqual(
        yield* recordReceipt(baseDir, environmentId, {
          ownerEnvironmentId: environmentId,
          receipt: { ...receipt, observedAt: "2026-08-19T06:00:59.000Z" },
          updatedAt: "2026-08-19T06:02:00.000Z",
        }),
        { accepted: false, reason: "older-receipt" },
      );
    }).pipe(Effect.provide(NodeServices.layer)),
  );

  it.effect("stages, accepts, and finalizes a paused owner transfer without overlap", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const sourceBaseDir = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "t3-portfolio-heartbeat-owner-transfer-source-",
      });
      const targetBaseDir = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "t3-portfolio-heartbeat-owner-transfer-target-",
      });
      const sourceEnvironmentId = "mac" as EnvironmentId;
      const targetEnvironmentId = "vps" as EnvironmentId;
      const target = {
        environmentId: sourceEnvironmentId,
        projectId: ProjectId.make("project-portfolio"),
        threadId: ThreadId.make("thread-heartbeat"),
      };

      yield* claimOwner(sourceBaseDir, sourceEnvironmentId, {
        ownerEnvironmentId: sourceEnvironmentId,
        target,
        portfolioRevision: 2,
        heartbeatRevision: 3,
        portfolioChecksum: "portfolio-sha",
        heartbeatChecksum: "heartbeat-sha",
        updatedAt: "2026-08-19T06:00:00.000Z",
      });

      const prepared = yield* prepareTransfer(sourceBaseDir, sourceEnvironmentId, {
        sourceOwnerEnvironmentId: sourceEnvironmentId,
        targetOwnerEnvironmentId: targetEnvironmentId,
        proposedOwnerEpoch: 1,
        heartbeatsPaused: true,
        preparedAt: "2026-08-19T06:02:00.000Z",
      });
      assert.equal(prepared.accepted, true);
      assert.equal(prepared.reason, "accepted");
      assert.exists(prepared.ticket);
      const ticket = prepared.ticket;

      const repeatedPreparation = yield* prepareTransfer(sourceBaseDir, sourceEnvironmentId, {
        sourceOwnerEnvironmentId: sourceEnvironmentId,
        targetOwnerEnvironmentId: targetEnvironmentId,
        proposedOwnerEpoch: 1,
        heartbeatsPaused: true,
        preparedAt: "2026-08-19T06:02:00.000Z",
      });
      assert.deepEqual(repeatedPreparation, {
        accepted: true,
        reason: "already-prepared",
        ticket,
      });

      assert.deepEqual(
        yield* acceptTransfer(targetBaseDir, targetEnvironmentId, {
          ticket,
          updatedAt: "2026-08-19T06:03:00.000Z",
        }),
        { accepted: true, reason: "accepted" },
      );
      assert.equal((yield* readOwner(targetBaseDir, targetEnvironmentId)).role, "owner");

      assert.deepEqual(
        yield* finalizeTransfer(sourceBaseDir, sourceEnvironmentId, {
          ticket,
          updatedAt: "2026-08-19T06:04:00.000Z",
        }),
        { accepted: true, reason: "accepted" },
      );
      const sourceReadback = yield* readOwner(sourceBaseDir, sourceEnvironmentId);
      assert.equal(sourceReadback.role, "non_owner");
      assert.equal(sourceReadback.descriptor?.ownerEnvironmentId, targetEnvironmentId);
      assert.equal(sourceReadback.descriptor?.ownerEpoch, 1);
    }).pipe(Effect.provide(NodeServices.layer)),
  );
});
