import { EnvironmentId, ProjectId, ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";
import {
  buildPortfolioHeartbeatReceipt,
  createPausedPortfolioHeartbeatLifecycle,
  decidePortfolioHeartbeatPause,
  decidePortfolioHeartbeatRunCompletion,
  decidePortfolioHeartbeatStart,
  decidePortfolioHeartbeatStop,
  decidePortfolioHeartbeatStopManually,
  PORTFOLIO_HEARTBEAT_RECEIPT_STATUSES,
} from "./portfolioHeartbeatLifecycle";

const target = {
  environmentId: EnvironmentId.make("env-mac"),
  projectId: ProjectId.make("project-portfolio"),
  threadId: ThreadId.make("thread-worker"),
};

const paused = (input?: {
  maxRuns?: number | null;
  expiresAt?: string | null;
  finishLine?: string | null;
}) => createPausedPortfolioHeartbeatLifecycle({ target, ...input });

describe("Portfolio Heartbeat lifecycle", () => {
  it("preserves exact native target identity and starts one bounded run", () => {
    const lifecycle = paused({ maxRuns: 2 });
    const started = decidePortfolioHeartbeatStart(lifecycle, {
      runId: "run-1",
      now: "2026-08-19T00:00:00.000Z",
    });

    expect(started).toMatchObject({
      accepted: true,
      reason: "continue",
      state: {
        state: "active",
        runCount: 0,
        maxRuns: 2,
        activeRunId: "run-1",
        target,
      },
    });
  });

  it("prevents overlap and returns to paused after a non-terminal run", () => {
    const started = decidePortfolioHeartbeatStart(paused({ maxRuns: 2 }), {
      runId: "run-1",
      now: "2026-08-19T00:00:00.000Z",
    });
    const overlap = decidePortfolioHeartbeatStart(started.state, {
      runId: "run-2",
      now: "2026-08-19T00:01:00.000Z",
    });
    const completed = decidePortfolioHeartbeatRunCompletion(started.state, {
      runId: "run-1",
      completedAt: "2026-08-19T00:02:00.000Z",
    });

    expect(overlap).toMatchObject({ accepted: false, reason: "overlap-prevented" });
    expect(completed).toMatchObject({
      accepted: true,
      reason: "continue",
      state: { state: "paused", runCount: 1, activeRunId: null },
    });
  });

  it("finishes on run limit or finish line and expires at the deadline", () => {
    const oneRun = decidePortfolioHeartbeatStart(paused({ maxRuns: 1 }), {
      runId: "run-1",
      now: "2026-08-19T00:00:00.000Z",
    });
    const runLimit = decidePortfolioHeartbeatRunCompletion(oneRun.state, {
      runId: "run-1",
      completedAt: "2026-08-19T00:01:00.000Z",
    });
    const finishLineStart = decidePortfolioHeartbeatStart(
      paused({ finishLine: "ship the receipt" }),
      { runId: "run-2", now: "2026-08-19T00:00:00.000Z" },
    );
    const finishLine = decidePortfolioHeartbeatRunCompletion(finishLineStart.state, {
      runId: "run-2",
      completedAt: "2026-08-19T00:01:00.000Z",
      finishLineReached: true,
    });
    const expired = decidePortfolioHeartbeatStart(
      paused({ expiresAt: "2026-08-19T00:00:00.000Z" }),
      { runId: "run-3", now: "2026-08-19T00:00:01.000Z" },
    );

    expect(runLimit).toMatchObject({
      accepted: true,
      reason: "run-limit-reached",
      state: { state: "finished", runCount: 1 },
    });
    expect(finishLine).toMatchObject({
      accepted: true,
      reason: "finish-line-reached",
      state: { state: "finished" },
    });
    expect(expired).toMatchObject({
      accepted: true,
      reason: "expiry-reached",
      state: { state: "expired" },
    });
  });

  it("supports explicit pause/stop decisions without reviving terminal states", () => {
    const started = decidePortfolioHeartbeatStart(paused(), {
      runId: "run-1",
      now: "2026-08-19T00:00:00.000Z",
    });
    const pausedAgain = decidePortfolioHeartbeatPause(started.state);
    const stopped = decidePortfolioHeartbeatStopManually(pausedAgain.state);
    const cannotResume = decidePortfolioHeartbeatStart(stopped.state, {
      runId: "run-2",
      now: "2026-08-19T00:01:00.000Z",
    });
    const noStop = decidePortfolioHeartbeatStop(pausedAgain.state, "2026-08-19T00:01:00.000Z");

    expect(pausedAgain).toMatchObject({
      accepted: true,
      reason: "manual-pause",
      state: { state: "paused" },
    });
    expect(stopped).toMatchObject({
      accepted: true,
      reason: "manual-stop",
      state: { state: "stopped" },
    });
    expect(cannotResume).toMatchObject({ accepted: false, reason: "already-terminal" });
    expect(noStop).toMatchObject({
      accepted: false,
      reason: "continue",
      state: { state: "paused" },
    });
  });

  it("builds every contract receipt status without transport side effects", () => {
    const receipts = PORTFOLIO_HEARTBEAT_RECEIPT_STATUSES.map((status) =>
      buildPortfolioHeartbeatReceipt({
        commandId: "command-1" as never,
        target,
        status,
        observedAt: "2026-08-19T00:00:00.000Z" as never,
        detail: ` ${status} `,
        sequence: 7,
      }),
    );

    expect(receipts.map((receipt) => receipt.status)).toEqual(PORTFOLIO_HEARTBEAT_RECEIPT_STATUSES);
    expect(receipts[0]).toMatchObject({
      commandId: "command-1",
      target,
      sequence: 7,
      detail: "accepted",
    });
  });
});
