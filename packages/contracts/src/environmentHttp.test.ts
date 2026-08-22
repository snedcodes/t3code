import { describe, expect, it } from "vite-plus/test";
import * as OpenApi from "effect/unstable/httpapi/OpenApi";
import * as Schema from "effect/Schema";

import {
  EnvironmentAuthInvalidError,
  EnvironmentHttpApi,
  EnvironmentInternalError,
  EnvironmentOperationForbiddenError,
  EnvironmentRequestInvalidError,
  EnvironmentResourceNotFoundError,
  EnvironmentScopeRequiredError,
  PortfolioTasksReadback,
} from "./environmentHttp.ts";

const traceId = "trace-1";

describe("environment HTTP errors", () => {
  // A client squashes the cause and shows `message`; an empty one becomes a generic
  // "The environment request failed." that names nothing the reader can act on.
  it("each carries a message that names its reason", () => {
    const errors = [
      new EnvironmentRequestInvalidError({
        code: "invalid_request",
        reason: "invalid_command",
        traceId,
      }),
      new EnvironmentAuthInvalidError({
        code: "auth_invalid",
        reason: "missing_credential",
        traceId,
      }),
      new EnvironmentScopeRequiredError({
        code: "insufficient_scope",
        requiredScope: "orchestration:read",
        traceId,
      }),
      new EnvironmentOperationForbiddenError({
        code: "operation_forbidden",
        reason: "current_session_revoke_not_allowed",
        traceId,
      }),
      new EnvironmentResourceNotFoundError({
        code: "not_found",
        reason: "thread_not_found",
        traceId,
      }),
      new EnvironmentInternalError({
        code: "internal_error",
        reason: "orchestration_snapshot_failed",
        traceId,
      }),
    ] as const;
    const details = [
      "invalid_command",
      "missing_credential",
      "orchestration:read",
      "current_session_revoke_not_allowed",
      "thread_not_found",
      "orchestration_snapshot_failed",
    ];
    errors.forEach((error, index) => {
      expect(error.message).toContain(details[index]);
    });
  });
});

const TARGET = {
  environmentId: "env-vps-dev",
  projectId: "project-portfolio",
  threadId: "thread-task-owner",
};

const RECEIPT = {
  commandId: "command-task-1",
  target: TARGET,
  status: "transcript-confirmed",
  sequence: 9,
  observedAt: "2026-08-22T01:00:00.000Z",
  detail: "Native target thread confirmed the turn",
};

const OWNER = {
  role: "owner",
  freshness: "fresh",
  descriptor: {
    schemaVersion: "portfolio_heartbeat_owner.v1",
    domain: "portfolio_heartbeat",
    ownerEnvironmentId: "env-vps-dev",
    ownerEpoch: 0,
    portfolioRevision: 167,
    heartbeatRevision: 1,
    portfolioChecksum: "portfolio-sha",
    heartbeatChecksum: "heartbeat-sha",
    updatedAt: "2026-08-22T01:00:00.000Z",
    target: TARGET,
    lastReceipt: RECEIPT,
  },
};

const TASK = {
  taskId: "task_readback_1",
  title: "Expose Tasks readback",
  outcome: "Clients can read the owner-backed Task projection",
  target: TARGET,
  status: "in_progress",
  priority: "high",
  assignment: { ownerPassportId: null, ownerHost: "WIN-HOK834JECO0" },
  checklistItems: [],
  completionCondition: "The focused contracts pass",
  planLinks: [],
  evidenceLinks: [],
  createdAt: "2026-08-22T00:00:00.000Z",
  updatedAt: "2026-08-22T01:00:00.000Z",
  completedAt: null,
  revision: 1,
  lastReceipt: RECEIPT,
  heartbeatId: null,
};

const WISHLIST = {
  wishlistId: "wishlist-readback-1",
  title: "Portfolio Tasks UI",
  summary: "Present the owner-backed readback after the runtime slice exists",
  status: "idea",
  priority: "normal",
  links: [],
  createdAt: "2026-08-22T00:00:00.000Z",
  updatedAt: "2026-08-22T00:00:00.000Z",
  revision: 1,
  promotedTaskId: null,
};

describe("Portfolio Tasks HTTP contract", () => {
  const decodeReadback = Schema.decodeUnknownSync(PortfolioTasksReadback);

  it("distinguishes an absent projection from an available projection with no records", () => {
    expect(
      decodeReadback({
        owner: { role: "owner_unavailable", freshness: "unknown", descriptor: null },
        projection: { availability: "empty" },
      }),
    ).toEqual({
      owner: { role: "owner_unavailable", freshness: "unknown", descriptor: null },
      projection: { availability: "empty" },
    });

    expect(
      decodeReadback({
        owner: OWNER,
        projection: {
          availability: "available",
          tasks: [],
          wishlist: [],
          unresolvedLegacyRecords: [],
        },
      }).projection,
    ).toEqual({
      availability: "available",
      tasks: [],
      wishlist: [],
      unresolvedLegacyRecords: [],
    });
  });

  it("reuses canonical Task, Wishlist, owner, and receipt shapes", () => {
    const readback = decodeReadback({
      owner: OWNER,
      projection: {
        availability: "available",
        tasks: [TASK],
        wishlist: [WISHLIST],
        unresolvedLegacyRecords: [],
      },
    });

    expect(readback.owner.role).toBe("owner");
    expect(readback.owner.freshness).toBe("fresh");
    expect(readback.owner.descriptor?.lastReceipt?.status).toBe("transcript-confirmed");
    if (readback.projection.availability !== "available") throw new Error("expected projection");
    expect(readback.projection.tasks[0]?.target).toEqual(TARGET);
    expect(readback.projection.tasks[0]?.lastReceipt?.status).toBe("transcript-confirmed");
    expect(readback.projection.wishlist[0]?.promotedTaskId).toBeNull();
  });

  it("keeps ambiguous legacy records explicit without inferring a canonical target", () => {
    const legacyRecord = {
      task_id: "legacy-task-1",
      project_id: "project-portfolio",
      owner_host: "WIN-HOK834JECO0",
    };
    const readback = decodeReadback({
      owner: OWNER,
      projection: {
        availability: "available",
        tasks: [],
        wishlist: [],
        unresolvedLegacyRecords: [
          { reason: "missing_or_ambiguous_native_target", record: legacyRecord },
        ],
      },
    });

    if (readback.projection.availability !== "available") throw new Error("expected projection");
    expect(readback.projection.unresolvedLegacyRecords[0]).toEqual({
      reason: "missing_or_ambiguous_native_target",
      record: legacyRecord,
    });
    expect(() =>
      decodeReadback({
        owner: OWNER,
        projection: {
          availability: "available",
          tasks: [],
          wishlist: [],
          unresolvedLegacyRecords: [
            { reason: "missing_or_ambiguous_native_target", record: "legacy-task-1" },
          ],
        },
      }),
    ).toThrow();
    expect(() =>
      decodeReadback({
        owner: OWNER,
        projection: {
          availability: "available",
          tasks: [{ ...TASK, target: undefined }],
          wishlist: [],
          unresolvedLegacyRecords: [],
        },
      }),
    ).toThrow();
  });

  it("publishes the projection as an authenticated GET endpoint", () => {
    const document = OpenApi.fromApi(EnvironmentHttpApi);
    const endpoint = document.paths["/api/portfolio/tasks"];

    expect(endpoint?.get).toBeDefined();
    expect(endpoint?.post).toBeUndefined();
  });
});
