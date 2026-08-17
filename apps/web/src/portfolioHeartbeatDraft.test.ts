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
  it("keeps native identity while leaving VoiceTools-owned configuration unavailable", () => {
    expect(buildPausedNativeHeartbeatDraft(target)).toEqual({
      target: {
        environmentId: "local",
        projectId: "project-1",
        threadId: "thread-1",
      },
      status: "paused",
      cadenceMinutes: null,
      maxRuns: null,
      expiresAt: null,
      finishLine: null,
      allowedActions: [],
      stopConditions: ["Paused by default", "Owner unavailable", "Native target missing"],
      receiptOwner: "VoiceTools Portfolio/Heartbeat owner (not connected)",
    });
  });
});
