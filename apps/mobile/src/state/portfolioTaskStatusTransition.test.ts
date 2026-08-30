import { describe, expect, it } from "vite-plus/test";
import { IsoDateTime, type PortfolioTask } from "@t3tools/contracts";
import { makePortfolioTaskStatusTransitionInput } from "./portfolioTaskStatusTransition";

const task = {
  taskId: "task-1",
  title: "Task",
  outcome: "Outcome",
  target: { environmentId: "env-1", projectId: "project-1", threadId: "thread-1" },
  status: "ready",
  priority: "normal",
  assignment: { ownerPassportId: null, ownerHost: null },
  checklistItems: [],
  completionCondition: "Complete",
  planLinks: [],
  evidenceLinks: [],
  createdAt: IsoDateTime.make("2026-08-24T00:00:00.000Z"),
  updatedAt: IsoDateTime.make("2026-08-24T00:00:00.000Z"),
  completedAt: null,
  revision: 3,
  lastReceipt: null,
  heartbeatId: null,
} as unknown as PortfolioTask;

describe("makePortfolioTaskStatusTransitionInput", () => {
  it("preserves exact target and revision", () => {
    expect(
      makePortfolioTaskStatusTransitionInput(task, "in_progress", "2026-08-24T01:00:00.000Z"),
    ).toEqual({
      taskId: "task-1",
      target: task.target,
      expectedRevision: 3,
      status: "in_progress",
      updatedAt: IsoDateTime.make("2026-08-24T01:00:00.000Z"),
    });
  });
});
