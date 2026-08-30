import { describe, expect, it } from "vite-plus/test";
import * as Schema from "effect/Schema";

import {
  PortfolioHeartbeatOwnerDescriptor,
  PortfolioHeartbeatOwnerReadback,
  PortfolioHeartbeatOwnerRole,
  PortfolioHeartbeatFreshness,
  PortfolioHeartbeatRecord,
  PortfolioHeartbeatRecordUpsertRequest,
  PortfolioHeartbeatReceipt,
  PortfolioHeartbeatReceiptStatus,
  PortfolioTask,
  PortfolioTaskCreateRequest,
  PortfolioTaskChecklistItem,
  PortfolioTaskStatus,
  PortfolioWishlist,
  PortfolioTarget,
  PortfolioTasksReadback,
  isPortfolioTaskRevisionAdvance,
  resolvePortfolioTaskLegacyTarget,
} from "./portfolio.ts";

const decodeTarget = Schema.decodeUnknownSync(PortfolioTarget);
const decodeReceipt = Schema.decodeUnknownSync(PortfolioHeartbeatReceipt);
const decodeDescriptor = Schema.decodeUnknownSync(PortfolioHeartbeatOwnerDescriptor);
const decodeReadback = Schema.decodeUnknownSync(PortfolioHeartbeatOwnerReadback);
const decodeTask = Schema.decodeUnknownSync(PortfolioTask);
const decodeTaskCreate = Schema.decodeUnknownSync(PortfolioTaskCreateRequest);
const decodeTasksReadback = Schema.decodeUnknownSync(PortfolioTasksReadback);
const decodeChecklistItem = Schema.decodeUnknownSync(PortfolioTaskChecklistItem);
const decodeWishlist = Schema.decodeUnknownSync(PortfolioWishlist);
const decodeHeartbeatRecord = Schema.decodeUnknownSync(PortfolioHeartbeatRecord);
const decodeHeartbeatUpsert = Schema.decodeUnknownSync(PortfolioHeartbeatRecordUpsertRequest);

const TARGET = {
  environmentId: "env-mac",
  projectId: "project-portfolio",
  threadId: "thread-heartbeat",
};

const RECEIPT = {
  commandId: "command-heartbeat-1",
  target: TARGET,
  status: "transcript-confirmed",
  sequence: 42,
  observedAt: "2026-08-19T12:00:00.000Z",
  detail: "Transcript confirmation observed",
};

describe("Portfolio heartbeat contracts", () => {
  it("decodes and brands the canonical native T3 target", () => {
    const target = decodeTarget({
      environmentId: "  env-mac  ",
      projectId: "project-portfolio",
      threadId: "thread-heartbeat",
    });

    expect(target).toEqual(TARGET);
  });

  it("decodes receipts with and without an optional dispatch sequence", () => {
    expect(decodeReceipt(RECEIPT)).toMatchObject(RECEIPT);
    expect(
      decodeReceipt({
        commandId: "command-heartbeat-2",
        target: TARGET,
        status: "accepted",
        observedAt: "2026-08-19T12:01:00.000Z",
        detail: "Accepted by target environment",
      }).sequence,
    ).toBeUndefined();
  });

  it("decodes an owner descriptor and nullable target/receipt", () => {
    const descriptor = decodeDescriptor({
      schemaVersion: "portfolio_heartbeat_owner.v1",
      domain: "portfolio_heartbeat",
      ownerEnvironmentId: "env-mac",
      ownerEpoch: 2,
      portfolioRevision: 11,
      heartbeatRevision: 13,
      portfolioChecksum: "portfolio-sha",
      heartbeatChecksum: "heartbeat-sha",
      updatedAt: "2026-08-19T12:02:00.000Z",
      target: null,
      lastReceipt: null,
    });

    expect(descriptor).toMatchObject({
      domain: "portfolio_heartbeat",
      ownerEnvironmentId: "env-mac",
      ownerEpoch: 2,
      target: null,
      lastReceipt: null,
    });
  });

  it("decodes owner readback roles and freshness", () => {
    const readback = decodeReadback({
      role: "owner",
      freshness: "fresh",
      descriptor: {
        schemaVersion: "portfolio_heartbeat_owner.v1",
        domain: "portfolio_heartbeat",
        ownerEnvironmentId: "env-mac",
        ownerEpoch: 2,
        portfolioRevision: 11,
        heartbeatRevision: 13,
        portfolioChecksum: "portfolio-sha",
        heartbeatChecksum: "heartbeat-sha",
        updatedAt: "2026-08-19T12:02:00.000Z",
        target: TARGET,
        lastReceipt: RECEIPT,
      },
    });

    expect(readback.role).toBe("owner");
    expect(readback.freshness).toBe("fresh");
    expect(readback.descriptor?.target).toEqual(TARGET);
    expect(readback.descriptor?.lastReceipt?.status).toBe("transcript-confirmed");
  });

  it("rejects values outside the typed role, freshness, and receipt status sets", () => {
    expect(() => Schema.decodeUnknownSync(PortfolioHeartbeatOwnerRole)("primary")).toThrow();
    expect(() => Schema.decodeUnknownSync(PortfolioHeartbeatFreshness)("current")).toThrow();
    expect(() => Schema.decodeUnknownSync(PortfolioHeartbeatReceiptStatus)("complete")).toThrow();
    expect(() =>
      decodeReadback({ role: "owner", freshness: "fresh", descriptor: null }),
    ).not.toThrow();
  });

  it("accepts legacy records without a message and trims editable upsert messages", () => {
    const legacy = {
      heartbeatId: "heartbeat-1",
      taskId: null,
      nextRunAt: null,
      target: TARGET,
      status: "paused",
      cadenceMinutes: 30,
      maxRuns: null,
      runCount: 0,
      expiresAt: null,
      finishLine: null,
      stopConditions: ["Operator stops the Heartbeat"],
      preventOverlap: true,
      pauseReason: null,
      stopReason: null,
      lastReceipt: null,
      updatedAt: "2026-08-30T00:00:00.000Z",
    };

    expect(decodeHeartbeatRecord(legacy).message).toBeUndefined();
    expect(
      decodeHeartbeatUpsert({ ...legacy, message: "  Continue this exact task.  " }).message,
    ).toBe("Continue this exact task.");
  });
});

const TASK_TARGET = {
  environmentId: "env-vps-dev",
  projectId: "project-portfolio",
  threadId: "thread-task-owner",
};

const TASK_RECEIPT = {
  commandId: "command-task-1",
  target: TASK_TARGET,
  status: "transcript-confirmed",
  sequence: 9,
  observedAt: "2026-08-21T12:00:00.000Z",
  detail: "Native target thread confirmed the turn",
};

const TASK = {
  taskId: "task_foundation_1",
  title: "Build the Tasks foundation",
  outcome: "A native owner-backed Task contract exists",
  target: TASK_TARGET,
  status: "in_progress",
  priority: "high",
  assignment: { ownerPassportId: "passport-1", ownerHost: "WIN-HOK834JECO0" },
  checklistItems: [
    {
      itemId: "contract",
      text: "Define the shared contract",
      state: "complete",
      evidence: "Focused contract tests",
      updatedBy: "tasks-worker",
      updatedAt: "2026-08-21T11:00:00.000Z",
    },
  ],
  completionCondition: "Contract and compatibility tests pass",
  planLinks: [],
  evidenceLinks: [],
  createdAt: "2026-08-21T10:00:00.000Z",
  updatedAt: "2026-08-21T12:00:00.000Z",
  completedAt: null,
  revision: 2,
  lastReceipt: TASK_RECEIPT,
  heartbeatId: null,
};

describe("Portfolio Task and Wishlist contracts", () => {
  it("uses the typed Task for create and owner-scoped list readback", () => {
    expect(decodeTaskCreate(TASK)).toEqual(TASK);
    expect(
      decodeTasksReadback({
        owner: { role: "owner", freshness: "fresh", descriptor: null },
        tasks: [TASK],
      }).tasks,
    ).toEqual([TASK]);
  });
  it("decodes a Task with exact target identity and separate native receipt state", () => {
    const task = decodeTask(TASK);

    expect(task.taskId).toBe("task_foundation_1");
    expect(task.target).toEqual(TASK_TARGET);
    expect(task.status).toBe("in_progress");
    expect(task.lastReceipt?.status).toBe("transcript-confirmed");
  });

  it("decodes checklist and Wishlist foundation shapes", () => {
    expect(decodeChecklistItem(TASK.checklistItems[0]).state).toBe("complete");
    expect(
      decodeWishlist({
        wishlistId: "wishlist-1",
        title: "Native Tasks",
        summary: "Make Tasks readable from every client",
        status: "idea",
        priority: "normal",
        links: [],
        createdAt: "2026-08-21T10:00:00.000Z",
        updatedAt: "2026-08-21T10:00:00.000Z",
        revision: 1,
        promotedTaskId: null,
      }).promotedTaskId,
    ).toBeNull();
  });

  it("rejects a Task without an exact native target", () => {
    expect(() => decodeTask({ ...TASK, target: null })).toThrow();
  });

  it("maps explicit legacy identity and leaves unresolved records unresolved", () => {
    expect(
      resolvePortfolioTaskLegacyTarget({
        environment_id: " env-vps-dev ",
        project_id: "project-portfolio",
        thread_id: "thread-task-owner",
      }),
    ).toEqual({ resolved: true, target: TASK_TARGET });

    expect(
      resolvePortfolioTaskLegacyTarget({
        project_id: "project-portfolio",
        owner_host: "WIN-HOK834JECO0",
      }),
    ).toEqual({ resolved: false, reason: "missing_or_ambiguous_native_target" });

    expect(
      resolvePortfolioTaskLegacyTarget({
        target: TASK_TARGET,
        environmentId: "env-other",
        projectId: "project-portfolio",
        threadId: "thread-task-owner",
      }),
    ).toEqual({ resolved: false, reason: "missing_or_ambiguous_native_target" });

    expect(
      resolvePortfolioTaskLegacyTarget({
        target: { environmentId: "env-vps-dev" },
        project_id: "project-portfolio",
        thread_id: "thread-task-owner",
      }),
    ).toEqual({ resolved: false, reason: "missing_or_ambiguous_native_target" });
  });

  it("accepts only forward revisions", () => {
    expect(isPortfolioTaskRevisionAdvance(1, 2)).toBe(true);
    expect(isPortfolioTaskRevisionAdvance(2, 2)).toBe(false);
    expect(isPortfolioTaskRevisionAdvance(2, 1)).toBe(false);
  });

  it("keeps Task status separate from the native receipt vocabulary", () => {
    expect(() => Schema.decodeUnknownSync(PortfolioTaskStatus)("transcript-confirmed")).toThrow();
  });
});
