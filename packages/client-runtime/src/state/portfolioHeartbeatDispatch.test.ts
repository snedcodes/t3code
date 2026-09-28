import { describe, expect, it } from "@effect/vitest";
import { EnvironmentId, ProjectId, RuntimeTaskId, ThreadId } from "@t3tools/contracts";

import { buildPortfolioHeartbeatPrompt, isPortfolioHeartbeatDue } from "./portfolioHeartbeatDispatch.ts";

const target = { environmentId: EnvironmentId.make("owner"), projectId: ProjectId.make("project"), threadId: ThreadId.make("thread") };
const heartbeat = {
  heartbeatId: "heartbeat-1", taskId: RuntimeTaskId.make("task-1"), message: null, target,
  status: "active" as const, cadenceMinutes: 30, nextRunAt: "2026-09-29T10:00:00.000Z", maxRuns: null,
  runCount: 0, expiresAt: null, stopConditions: [], preventOverlap: true, stopReason: null,
  lastReceipt: null, updatedAt: "2026-09-29T09:00:00.000Z", revision: 1,
};

describe("Portfolio Heartbeat dispatch", () => {
  it("only dispatches active Heartbeats whose next run has arrived", () => {
    expect(isPortfolioHeartbeatDue(heartbeat, "2026-09-29T10:00:00.000Z")).toBe(true);
    expect(isPortfolioHeartbeatDue({ ...heartbeat, status: "paused" }, "2026-09-29T11:00:00.000Z")).toBe(false);
    expect(isPortfolioHeartbeatDue(heartbeat, "not-a-date")).toBe(false);
  });

  it("uses the editable message or falls back to linked Task progress", () => {
    expect(buildPortfolioHeartbeatPrompt({ ...heartbeat, message: "  Check the build  " }, null)).toBe("Check the build");
    const prompt = buildPortfolioHeartbeatPrompt(heartbeat, {
      taskId: RuntimeTaskId.make("task-1"), title: "Ship the fix", outcome: "Working build", target,
      status: "in_progress", priority: "normal", ownerPassportId: null, ownerHost: null,
      checklistItems: [{ itemId: "ci", text: "Run focused test", state: "open", evidence: null, updatedAt: heartbeat.updatedAt }],
      completionCondition: "Test passes", planLinks: [], evidenceLinks: [], createdAt: heartbeat.updatedAt,
      updatedAt: heartbeat.updatedAt, completedAt: null, revision: 1, lastReceipt: null, heartbeatId: "heartbeat-1",
    });
    expect(prompt).toContain("- [open] Run focused test");
    expect(prompt).toContain("Completion condition: Test passes");
  });
});
