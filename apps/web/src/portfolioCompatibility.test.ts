import { EnvironmentId, ProjectId, RuntimeTaskId, ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vitest";

import { fromPortfolioTaskView, toPortfolioTaskView, updatePortfolioTaskView } from "./portfolioCompatibility";

const task = {
  taskId: RuntimeTaskId.make("task-1"),
  title: "Restore Portfolio",
  outcome: "Use the established Portfolio UI",
  target: {
    environmentId: EnvironmentId.make("env-1"),
    projectId: ProjectId.make("project-1"),
    threadId: ThreadId.make("thread-1"),
  },
  status: "ready" as const,
  priority: "high",
  ownerPassportId: "agent-1",
  ownerHost: "vps",
  checklistItems: [{ itemId: "item-1", text: "Keep evidence", state: "open" as const, evidence: null, updatedBy: "operator", updatedAt: "2026-09-29T00:00:00.000Z" }],
  completionCondition: "Verified",
  planLinks: [{ linkId: "plan-1", repository: "repo", relativePath: "plan.md", owningHost: "vps", title: "Plan", gitRevision: null, primary: true }],
  evidenceLinks: [],
  createdAt: "2026-09-29T00:00:00.000Z",
  updatedAt: "2026-09-29T00:00:00.000Z",
  completedAt: null,
  revision: 1,
  lastReceipt: null,
  heartbeatId: null,
};

describe("Portfolio compatibility boundary", () => {
  it("round trips flat assignment, checklist author, and primary document semantics", () => {
    const view = toPortfolioTaskView(task);
    expect(view.assignment).toEqual({ ownerPassportId: "agent-1", ownerHost: "vps" });
    expect(fromPortfolioTaskView(view)).toEqual(task);
  });

  it("rejects edits that change the stable task target", () => {
    expect(() => updatePortfolioTaskView(task, (view) => ({ ...view, target: { ...view.target, threadId: ThreadId.make("thread-2") } }))).toThrow("immutable");
  });
});
