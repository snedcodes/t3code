import { CommandId, EnvironmentId, ProjectId, RuntimeTaskId, ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import { PrimaryConnectionTarget, type PreparedConnection } from "../connection/model.ts";
import { remoteHttpClientLayer } from "../rpc/http.ts";
import {
  prepareEnvironmentPortfolioHeartbeatOwnerTransfer,
  claimEnvironmentPortfolioHeartbeatOwner,
  fetchEnvironmentPortfolioHeartbeatOwner,
  recordEnvironmentPortfolioHeartbeatReceipt,
  updateEnvironmentPortfolioTask,
  upsertEnvironmentPortfolioHeartbeatRecord,
} from "./portfolioHeartbeatOwnerHttp.ts";

const TARGET = new PrimaryConnectionTarget({
  environmentId: EnvironmentId.make("environment-1"),
  label: "Test environment",
  httpBaseUrl: "https://environment.example.test/base",
  wsBaseUrl: "wss://environment.example.test",
});

describe("updateEnvironmentPortfolioTask", () => {
  it.effect("posts the expected revision and mutable work fields to the owner API", () =>
    Effect.gen(function* () {
      const calls: Array<readonly [RequestInfo | URL, RequestInit]> = [];
      const target = {
        environmentId: TARGET.environmentId,
        projectId: ProjectId.make("project-1"),
        threadId: ThreadId.make("thread-1"),
      };
      const payload = {
        taskId: RuntimeTaskId.make("task-1"),
        target,
        expectedRevision: 2,
        title: "Living Task",
        outcome: "The Task evolves",
        priority: "high",
        completionCondition: "Evidence is visible",
        checklistItems: [],
        evidenceLinks: [],
        heartbeatId: "heartbeat-1",
        updatedAt: "2026-08-30T00:00:00.000Z",
      };
      const task = {
        ...payload,
        status: "in_progress" as const,
        assignment: { ownerPassportId: null, ownerHost: "vps-dev" },
        planLinks: [],
        createdAt: "2026-08-29T00:00:00.000Z",
        completedAt: null,
        revision: 3,
        lastReceipt: null,
      };
      const fetchFn = ((request, init) => {
        calls.push([request, init ?? {}]);
        return Promise.resolve(
          Response.json({
            owner: { role: "owner_unavailable", freshness: "unknown", descriptor: null },
            task,
          }),
        );
      }) satisfies typeof fetch;

      const result = yield* updateEnvironmentPortfolioTask({
        prepared: PREPARED,
        signer: Option.none(),
        payload,
      }).pipe(Effect.provide(remoteHttpClientLayer(fetchFn)));

      expect(result.task?.revision).toBe(3);
      const [request, init] = calls[0]!;
      expect(String(request)).toBe("https://environment.example.test/api/portfolio/tasks/update");
      expect(init.method).toBe("POST");
      const body = new TextDecoder().decode(init.body as Uint8Array);
      expect(body).toContain('"expectedRevision":2');
      expect(body).toContain('"heartbeatId":"heartbeat-1"');
    }),
  );
});

const PREPARED: PreparedConnection = {
  environmentId: TARGET.environmentId,
  label: TARGET.label,
  httpBaseUrl: TARGET.httpBaseUrl,
  socketUrl: "wss://environment.example.test/ws",
  httpAuthorization: null,
  target: TARGET,
};

describe("fetchEnvironmentPortfolioHeartbeatOwner", () => {
  it.effect("reads the owner descriptor through the prepared environment", () =>
    Effect.gen(function* () {
      const calls: Array<readonly [RequestInfo | URL, RequestInit]> = [];
      const fetchFn = ((request, init) => {
        calls.push([request, init ?? {}]);
        return Promise.resolve(
          Response.json({
            role: "owner_unavailable",
            freshness: "unknown",
            descriptor: null,
          }),
        );
      }) satisfies typeof fetch;

      const result = yield* fetchEnvironmentPortfolioHeartbeatOwner({
        prepared: PREPARED,
        signer: Option.none(),
      }).pipe(Effect.provide(remoteHttpClientLayer(fetchFn)));

      expect(result).toEqual({
        role: "owner_unavailable",
        freshness: "unknown",
        descriptor: null,
      });
      expect(calls).toHaveLength(1);
      const [request, init] = calls[0]!;
      expect(String(request)).toBe(
        "https://environment.example.test/api/portfolio/heartbeat-owner",
      );
      expect(init.method).toBe("GET");
      expect(init.credentials).toBe("include");
    }),
  );
});

describe("claimEnvironmentPortfolioHeartbeatOwner", () => {
  it.effect("uses the authenticated native Portfolio claim route", () =>
    Effect.gen(function* () {
      const calls: Array<readonly [RequestInfo | URL, RequestInit]> = [];
      const fetchFn = ((request, init) => {
        calls.push([request, init ?? {}]);
        return Promise.resolve(
          Response.json({
            role: "owner",
            freshness: "fresh",
            descriptor: null,
          }),
        );
      }) satisfies typeof fetch;
      const payload = {
        target: {
          environmentId: TARGET.environmentId,
          projectId: ProjectId.make("project-1"),
          threadId: ThreadId.make("thread-1"),
        },
        portfolioRevision: 0,
        heartbeatRevision: 0,
        portfolioChecksum: "portfolio-initial",
        heartbeatChecksum: "heartbeat-initial",
      };

      const result = yield* claimEnvironmentPortfolioHeartbeatOwner({
        prepared: PREPARED,
        signer: Option.none(),
        payload,
      }).pipe(Effect.provide(remoteHttpClientLayer(fetchFn)));

      expect(result.role).toBe("owner");
      expect(calls).toHaveLength(1);
      const [request, init] = calls[0]!;
      expect(String(request)).toBe(
        "https://environment.example.test/api/portfolio/heartbeat-owner/claim",
      );
      expect(init.method).toBe("POST");
      expect(init.credentials).toBe("include");
      expect(new TextDecoder().decode(init.body as Uint8Array)).toContain("portfolio-initial");
    }),
  );
});

describe("upsertEnvironmentPortfolioHeartbeatRecord", () => {
  it.effect("posts an editable custom message on the native Portfolio API", () =>
    Effect.gen(function* () {
      const calls: Array<readonly [RequestInfo | URL, RequestInit]> = [];
      const payload = {
        heartbeatId: "heartbeat-1",
        taskId: null,
        message: "Continue the exact task until complete.",
        nextRunAt: null,
        target: {
          environmentId: TARGET.environmentId,
          projectId: ProjectId.make("project-1"),
          threadId: ThreadId.make("thread-1"),
        },
        enabled: false,
        activeRunId: null,
        disabledReason: "Awaiting turn on.",
        cadenceMinutes: 30,
        maxRuns: null,
        runCount: 0,
        expiresAt: null,
        finishLine: null,
        stopConditions: ["Operator stops the Heartbeat"],
        preventOverlap: true,
        lastReceipt: null,
        updatedAt: "2026-08-30T00:00:00.000Z",
      };
      const fetchFn = ((request, init) => {
        calls.push([request, init ?? {}]);
        return Promise.resolve(
          Response.json({
            owner: { role: "owner_unavailable", freshness: "unknown", descriptor: null },
            records: [payload],
          }),
        );
      }) satisfies typeof fetch;

      const result = yield* upsertEnvironmentPortfolioHeartbeatRecord({
        prepared: PREPARED,
        signer: Option.none(),
        payload,
      }).pipe(Effect.provide(remoteHttpClientLayer(fetchFn)));

      expect(result.records[0]?.message).toBe(payload.message);
      expect(calls).toHaveLength(1);
      const [request, init] = calls[0]!;
      expect(String(request)).toBe("https://environment.example.test/api/portfolio/heartbeats");
      expect(init.method).toBe("POST");
      expect(new TextDecoder().decode(init.body as Uint8Array)).toContain(payload.message);
    }),
  );
});

describe("recordEnvironmentPortfolioHeartbeatReceipt", () => {
  it.effect("uses the authenticated native Portfolio receipt route", () =>
    Effect.gen(function* () {
      const calls: Array<readonly [RequestInfo | URL, RequestInit]> = [];
      const fetchFn = ((request, init) => {
        calls.push([request, init ?? {}]);
        return Promise.resolve(
          Response.json({
            role: "owner",
            freshness: "fresh",
            descriptor: null,
          }),
        );
      }) satisfies typeof fetch;
      const payload = {
        commandId: CommandId.make("heartbeat-command-1"),
        target: {
          environmentId: TARGET.environmentId,
          projectId: ProjectId.make("project-1"),
          threadId: ThreadId.make("thread-1"),
        },
        status: "transcript-confirmed" as const,
        sequence: 7,
        observedAt: "2026-08-19T06:01:00.000Z",
        detail: "Bounded proof confirmed.",
      };

      const result = yield* recordEnvironmentPortfolioHeartbeatReceipt({
        prepared: PREPARED,
        signer: Option.none(),
        payload,
      }).pipe(Effect.provide(remoteHttpClientLayer(fetchFn)));

      expect(result.role).toBe("owner");
      expect(calls).toHaveLength(1);
      const [request, init] = calls[0]!;
      expect(String(request)).toBe(
        "https://environment.example.test/api/portfolio/heartbeat-owner/receipt",
      );
      expect(init.method).toBe("POST");
      expect(init.credentials).toBe("include");
      expect(new TextDecoder().decode(init.body as Uint8Array)).toContain("transcript-confirmed");
    }),
  );
});

describe("prepareEnvironmentPortfolioHeartbeatOwnerTransfer", () => {
  it.effect("uses the authenticated staged transfer route", () =>
    Effect.gen(function* () {
      const calls: Array<readonly [RequestInfo | URL, RequestInit]> = [];
      const fetchFn = ((request, init) => {
        calls.push([request, init ?? {}]);
        return Promise.resolve(
          Response.json({
            transferId: "transfer-1",
            sourceOwnerEnvironmentId: TARGET.environmentId,
            targetOwnerEnvironmentId: EnvironmentId.make("environment-vps"),
            ownerEpoch: 1,
            portfolioRevision: 2,
            heartbeatRevision: 3,
            portfolioChecksum: "portfolio-sha",
            heartbeatChecksum: "heartbeat-sha",
            target: {
              environmentId: TARGET.environmentId,
              projectId: ProjectId.make("project-1"),
              threadId: ThreadId.make("thread-1"),
            },
            lastReceipt: null,
            preparedAt: "2026-08-19T06:02:00.000Z",
            heartbeatsPaused: true,
          }),
        );
      }) satisfies typeof fetch;

      const result = yield* prepareEnvironmentPortfolioHeartbeatOwnerTransfer({
        prepared: PREPARED,
        signer: Option.none(),
        payload: {
          targetOwnerEnvironmentId: EnvironmentId.make("environment-vps"),
          proposedOwnerEpoch: 1,
          heartbeatsPaused: true,
        },
      }).pipe(Effect.provide(remoteHttpClientLayer(fetchFn)));

      expect(result.transferId).toBe("transfer-1");
      expect(calls).toHaveLength(1);
      const [request, init] = calls[0]!;
      expect(String(request)).toBe(
        "https://environment.example.test/api/portfolio/heartbeat-owner/transfer/prepare",
      );
      expect(init.method).toBe("POST");
      expect(init.credentials).toBe("include");
      expect(new TextDecoder().decode(init.body as Uint8Array)).toContain("heartbeatsPaused");
    }),
  );
});
