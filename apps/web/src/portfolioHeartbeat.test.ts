import { describe, expect, it } from "vite-plus/test";

import {
  createPausedNativeHeartbeat,
  selectActiveNativeHeartbeatThreads,
  validateNativeHeartbeat,
} from "./portfolioHeartbeat";

function thread(overrides: Record<string, unknown> = {}) {
  return {
    id: "thread-id",
    projectId: "project-id",
    title: "Native thread",
    modelSelection: { provider: "codex", model: "gpt-5" },
    runtimeMode: "local",
    interactionMode: "default",
    branch: null,
    worktreePath: null,
    latestTurn: null,
    createdAt: "2026-08-15T00:00:00.000Z",
    updatedAt: "2026-08-15T01:00:00.000Z",
    archivedAt: null,
    settledOverride: null,
    settledAt: null,
    session: null,
    latestUserMessageAt: null,
    hasPendingApprovals: false,
    hasPendingUserInput: false,
    hasActionableProposedPlan: false,
    ...overrides,
  } as unknown as import("@t3tools/contracts").OrchestrationThreadShell;
}

describe("portfolioHeartbeat", () => {
  it("creates a paused, one-turn native T3 definition without session identity", () => {
    const definition = createPausedNativeHeartbeat();

    expect(definition.status).toBe("paused");
    expect(definition.targetThread).toBeNull();
    expect(definition.maxRuns).toBe(1);
    expect(definition.allowedActions).toEqual(["send-normal-t3-turn"]);
    expect(definition.receiptOwner).toBe("native-t3-orchestration");
    expect("sessionKey" in definition).toBe(false);
  });

  it("accepts the bounded default and rejects unsafe changes", () => {
    const definition = createPausedNativeHeartbeat();
    expect(validateNativeHeartbeat(definition).valid).toBe(true);

    const invalid = validateNativeHeartbeat({
      ...definition,
      cadenceMinutes: 0,
      maxRuns: 0,
      finishLine: "",
      allowedActions: ["dispatch-heartbeat"] as never,
      stopConditions: [],
      receiptOwner: "voicetools" as never,
    });
    expect(invalid.valid).toBe(false);
    expect(invalid.errors).toHaveLength(6);
  });

  it("selects only non-archived, non-settled native threads in update order", () => {
    const selected = selectActiveNativeHeartbeatThreads(
      [
        thread({ id: "quiet", updatedAt: "2026-08-15T01:00:00.000Z" }),
        thread({ id: "newest", updatedAt: "2026-08-15T03:00:00.000Z" }),
        thread({ id: "settled", settledOverride: "settled" }),
        thread({ id: "archived", archivedAt: "2026-08-15T04:00:00.000Z" }),
      ],
      { now: "2026-08-15T04:00:00.000Z", autoSettleAfterDays: null },
    );

    expect(selected.map((candidate) => candidate.id)).toEqual(["newest", "quiet"]);
  });
});
