import { describe, expect, it } from "vite-plus/test";
import { buildPausedNativeHeartbeatDraft } from "./portfolioHeartbeatDraft";
import type { NativeHeartbeatTarget } from "./portfolioHeartbeatTargets";

const target: NativeHeartbeatTarget = {
  key: "local:thread-1",
  environmentId: "local" as never,
  projectId: "project-1" as never,
  threadId: "thread-1" as never,
  projectTitle: "Project",
  threadTitle: "Thread",
  updatedAt: "2026-08-17T00:00:00.000Z",
  sessionStatus: "stopped",
  hasActiveTurn: false,
};

describe("buildPausedNativeHeartbeatDraft", () => {
  it("keeps native identity while leaving scheduling paused", () => {
    expect(buildPausedNativeHeartbeatDraft(target)).toMatchObject({
      target: {
        environmentId: "local",
        projectId: "project-1",
        threadId: "thread-1",
      },
      lifecycle: {
        state: "paused",
        runCount: 0,
        maxRuns: null,
        activeRunId: null,
        target: {
          environmentId: "local",
          projectId: "project-1",
          threadId: "thread-1",
        },
      },
      status: "paused",
      cadenceMinutes: null,
      maxRuns: null,
      expiresAt: null,
      finishLine: null,
      allowedActions: [],
      stopConditions: [
        "Maximum runs exhausted",
        "Expiry reached",
        "Goal or finish line reached",
        "Manual pause or stop",
      ],
      receiptOwner: "Native T3 Portfolio owner readback (paused)",
    });
  });
});
