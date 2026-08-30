import { EnvironmentId, ProjectId, RuntimeTaskId, ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";
import { makePortfolioTaskStatusCommandInput } from "./portfolioTasks";

describe("mobile Portfolio task status interaction", () => {
  it("preserves the exact environment and native target", () => {
    const task = {
      taskId: RuntimeTaskId.make("task-1"),
      title: "Ship Tasks",
      outcome: "Visible",
      target: {
        environmentId: EnvironmentId.make("environment-vps"),
        projectId: ProjectId.make("project-1"),
        threadId: ThreadId.make("thread-1"),
      },
      status: "ready" as const,
      priority: "normal",
      assignment: { ownerPassportId: null, ownerHost: null },
      checklistItems: [],
      completionCondition: "complete",
      planLinks: [],
      evidenceLinks: [],
      createdAt: "2026-08-24T00:00:00.000Z",
      updatedAt: "2026-08-24T00:00:00.000Z",
      completedAt: null,
      revision: 3,
      lastReceipt: null,
      heartbeatId: null,
    };
    expect(
      makePortfolioTaskStatusCommandInput(task, "in_progress", "2026-08-24T01:00:00.000Z"),
    ).toEqual({
      environmentId: task.target.environmentId,
      input: {
        taskId: task.taskId,
        target: task.target,
        expectedRevision: 3,
        status: "in_progress",
        updatedAt: "2026-08-24T01:00:00.000Z",
      },
    });
  });
});
