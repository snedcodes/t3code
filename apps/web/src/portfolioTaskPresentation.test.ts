import { RuntimeTaskId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  formatPortfolioTaskAssignedAgent,
  formatPortfolioTaskChecklistProgress,
  formatPortfolioTaskEnvironmentLabel,
} from "./portfolioTaskPresentation";

const task = {
  taskId: RuntimeTaskId.make("task-1"),
  title: "Ship the native slice",
  outcome: "A visible Task detail pane exists",
  target: {
    environmentId: "mac" as never,
    projectId: "project-1" as never,
    threadId: "thread-1" as never,
  },
  status: "in_progress" as const,
  priority: "high" as const,
  assignment: { ownerPassportId: null, ownerHost: "MacBook Pro" },
  checklistItems: [
    {
      itemId: "one",
      text: "Card",
      state: "complete" as const,
      evidence: null,
      updatedBy: null,
      updatedAt: "2026-08-26T00:00:00.000Z",
    },
    {
      itemId: "two",
      text: "Detail",
      state: "open" as const,
      evidence: null,
      updatedBy: null,
      updatedAt: "2026-08-26T00:00:00.000Z",
    },
  ],
} as never;

describe("Portfolio Task presentation", () => {
  it("formats friendly target, assignment, and checklist values without changing IDs", () => {
    expect(formatPortfolioTaskEnvironmentLabel("mac", new Map([["mac", "MacBook Pro"]]))).toBe(
      "MacBook Pro",
    );
    expect(formatPortfolioTaskAssignedAgent(task)).toBe("MacBook Pro");
    expect(formatPortfolioTaskChecklistProgress(task)).toBe("1/2");
  });
});
