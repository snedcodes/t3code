import { describe, expect, it } from "@effect/vitest";
import { EnvironmentId, ProjectId, RuntimeTaskId, ThreadId } from "@t3tools/contracts";

import { stopHeartbeatForTaskUnlink, stopHeartbeatForTerminalTask } from "./PortfolioTransitions.ts";

const target = { environmentId: EnvironmentId.make("owner"), projectId: ProjectId.make("project"), threadId: ThreadId.make("thread") };
const base = {
  heartbeat: {
    heartbeatId: "heartbeat-1", taskId: RuntimeTaskId.make("task-1"), message: null, target,
    status: "active" as const, cadenceMinutes: 60, nextRunAt: "2026-09-29T10:00:00.000Z", maxRuns: null,
    runCount: 2, expiresAt: null, stopConditions: [], preventOverlap: true, stopReason: null,
    lastReceipt: null, updatedAt: "2026-09-29T09:00:00.000Z", revision: 3,
  },
  task: {
    taskId: RuntimeTaskId.make("task-1"), title: "Ship", outcome: "Shipped", target, status: "complete" as const,
    priority: "normal", ownerPassportId: null, ownerHost: null, checklistItems: [], completionCondition: "Done",
    planLinks: [], evidenceLinks: [], createdAt: "2026-09-29T08:00:00.000Z", updatedAt: "2026-09-29T09:30:00.000Z",
    completedAt: "2026-09-29T09:30:00.000Z", revision: 2, lastReceipt: null, heartbeatId: "heartbeat-1",
  },
};

describe("Portfolio terminal transitions", () => {
  it("shuts off the linked recurring Heartbeat when its Task completes", () => {
    expect(stopHeartbeatForTerminalTask(base.heartbeat, base.task)).toMatchObject({
      status: "completed", nextRunAt: null, revision: 4, stopReason: "Linked Task complete.",
    });
  });

  it("stops blocked or cancelled linked Heartbeats and leaves unrelated ones alone", () => {
    expect(stopHeartbeatForTerminalTask(base.heartbeat, { ...base.task, status: "blocked" })).toMatchObject({ status: "stopped", nextRunAt: null });
    expect(stopHeartbeatForTerminalTask(base.heartbeat, { ...base.task, status: "cancelled" })).toMatchObject({ status: "stopped", nextRunAt: null });
    expect(stopHeartbeatForTerminalTask({ ...base.heartbeat, heartbeatId: "other" }, base.task)).toBeNull();
  });

  it("turns off a former linked Heartbeat when a Task is reassigned to another one", () => {
    expect(stopHeartbeatForTaskUnlink(base.heartbeat, base.task.taskId, "2026-09-29T10:00:00.000Z")).toMatchObject({
      status: "stopped", nextRunAt: null, stopReason: "Linked Task Heartbeat changed.", revision: 4,
    });
  });
});
