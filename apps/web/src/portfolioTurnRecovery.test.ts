import { describe, expect, it } from "vite-plus/test";
import { TurnId, type OrchestrationSession } from "@t3tools/contracts";
import {
  assessHungTurn,
  decideHungTurnRecovery,
  DEFAULT_HUNG_TURN_THRESHOLD_MS,
} from "./portfolioTurnRecovery";

const runningSession = (
  updatedAt: string,
): Pick<OrchestrationSession, "status" | "activeTurnId" | "updatedAt"> => ({
  status: "running",
  activeTurnId: TurnId.make("turn_123"),
  updatedAt,
});

describe("assessHungTurn", () => {
  it("does not report a stopped or idle session as hung", () => {
    expect(
      assessHungTurn({
        status: "stopped",
        activeTurnId: TurnId.make("turn_123"),
        updatedAt: "not-a-date",
      }),
    ).toMatchObject({ state: "not-running", canInterrupt: false });
    expect(assessHungTurn(null)).toMatchObject({ state: "not-running" });
  });

  it("reports a recently updated running turn as working", () => {
    const now = Date.parse("2026-08-16T00:02:00.000Z");
    expect(assessHungTurn(runningSession("2026-08-16T00:00:30.000Z"), { now })).toMatchObject({
      state: "working",
      elapsedMs: 90_000,
      thresholdMs: DEFAULT_HUNG_TURN_THRESHOLD_MS,
      canInterrupt: true,
      recommendedAction: "observe",
    });
  });

  it("reports a quiet running turn as stale after the threshold", () => {
    const now = Date.parse("2026-08-16T00:03:00.000Z");
    expect(assessHungTurn(runningSession("2026-08-16T00:00:00.000Z"), { now })).toMatchObject({
      state: "stale",
      elapsedMs: DEFAULT_HUNG_TURN_THRESHOLD_MS + 60_000,
      canInterrupt: true,
      recommendedAction: "stop-and-review",
    });
  });

  it("uses recent native work activity instead of an older session timestamp", () => {
    const now = Date.parse("2026-08-16T00:03:00.000Z");
    expect(
      assessHungTurn(runningSession("2026-08-16T00:00:00.000Z"), {
        now,
        lastProgressAt: "2026-08-16T00:02:30.000Z",
      }),
    ).toMatchObject({ state: "working", elapsedMs: 30_000 });
  });

  it("does not call a known in-progress tool call stuck", () => {
    const now = Date.parse("2026-08-16T00:10:00.000Z");
    expect(
      assessHungTurn(runningSession("2026-08-16T00:00:00.000Z"), {
        now,
        hasActiveWork: true,
      }),
    ).toMatchObject({ state: "working", elapsedMs: 600_000 });
  });

  it("stays honest when the native timestamp cannot be assessed", () => {
    expect(assessHungTurn(runningSession("not-a-date"))).toMatchObject({
      state: "unknown",
      elapsedMs: null,
      canInterrupt: true,
      recommendedAction: "observe",
    });
  });

  it("only retries a genuinely stale turn when auto resend is enabled", () => {
    const assessment = assessHungTurn(runningSession("2026-08-16T00:00:00.000Z"), {
      now: Date.parse("2026-08-16T00:03:00.000Z"),
    });
    expect(
      decideHungTurnRecovery(assessment, {
        autoResendEnabled: false,
        hasToolActivity: false,
        alreadyAttempted: false,
      }),
    ).toBe("none");
    expect(
      decideHungTurnRecovery(assessment, {
        autoResendEnabled: true,
        hasToolActivity: false,
        alreadyAttempted: false,
      }),
    ).toBe("interrupt-and-retry");
    expect(
      decideHungTurnRecovery(assessment, {
        autoResendEnabled: true,
        hasToolActivity: false,
        alreadyAttempted: true,
      }),
    ).toBe("none");
  });

  it("stops for review instead of retrying after tool activity", () => {
    const assessment = assessHungTurn(runningSession("2026-08-16T00:00:00.000Z"), {
      now: Date.parse("2026-08-16T00:03:00.000Z"),
    });
    expect(
      decideHungTurnRecovery(assessment, {
        autoResendEnabled: true,
        hasToolActivity: true,
        alreadyAttempted: false,
      }),
    ).toBe("interrupt-and-review");
  });

  it("does not interrupt while the provider is waiting for approval or input", () => {
    const assessment = assessHungTurn(runningSession("2026-08-16T00:00:00.000Z"), {
      now: Date.parse("2026-08-16T00:03:00.000Z"),
    });
    expect(
      decideHungTurnRecovery(assessment, {
        autoResendEnabled: true,
        hasToolActivity: false,
        alreadyAttempted: false,
        blockedByInteraction: true,
      }),
    ).toBe("none");
  });
});
