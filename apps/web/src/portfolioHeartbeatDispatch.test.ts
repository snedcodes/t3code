import { CommandId, EnvironmentId, MessageId, ProjectId, ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { createPausedPortfolioHeartbeatLifecycle } from "./portfolioHeartbeatLifecycle";
import {
  dispatchPortfolioHeartbeatNativeTurn,
  preparePortfolioHeartbeatNativeTurn,
} from "./portfolioHeartbeatDispatch";

const target = {
  environmentId: EnvironmentId.make("environment-mac"),
  projectId: ProjectId.make("project-reliability"),
  threadId: ThreadId.make("thread-worker"),
};

const input = (
  overrides: Partial<Parameters<typeof preparePortfolioHeartbeatNativeTurn>[0]> = {},
) => ({
  lifecycle: createPausedPortfolioHeartbeatLifecycle({ target, maxRuns: 1 }),
  runId: "run-1",
  commandId: CommandId.make("command-1"),
  messageId: MessageId.make("message-1"),
  message: "Run one bounded native Heartbeat proof and report the receipt.",
  now: "2026-08-19T06:00:00.000Z",
  ...overrides,
});

describe("Portfolio Heartbeat native dispatch preparation", () => {
  it("prepares one exact environment-scoped native turn without dispatching it", () => {
    const prepared = preparePortfolioHeartbeatNativeTurn(input());

    expect(prepared).toMatchObject({
      accepted: true,
      lifecycle: { state: "active", activeRunId: "run-1" },
      receipt: {
        status: "accepted",
        detail: "Bounded Heartbeat turn prepared; native dispatch is still pending.",
      },
      command: {
        environmentId: target.environmentId,
        projectId: target.projectId,
        command: {
          type: "thread.turn.start",
          threadId: target.threadId,
          message: {
            messageId: MessageId.make("message-1"),
            role: "user",
            text: "Run one bounded native Heartbeat proof and report the receipt.",
            attachments: [],
          },
          runtimeMode: "full-access",
          interactionMode: "default",
        },
      },
    });
  });

  it("fails without a message or when lifecycle overlap prevents a second run", () => {
    expect(preparePortfolioHeartbeatNativeTurn(input({ message: "  " }))).toMatchObject({
      accepted: false,
      command: null,
      receipt: { status: "failed" },
    });

    const active = preparePortfolioHeartbeatNativeTurn(input());
    expect(
      preparePortfolioHeartbeatNativeTurn({
        ...input(),
        lifecycle: active.lifecycle,
        runId: "run-2",
      }),
    ).toMatchObject({
      accepted: false,
      command: null,
      lifecycle: { state: "active", activeRunId: "run-1" },
      receipt: {
        status: "failed",
        detail: "Bounded Heartbeat turn was not prepared: overlap-prevented.",
      },
    });
  });

  it("sends one prepared native turn and records the accepted sequence", async () => {
    const sent: string[] = [];
    const dispatched = await dispatchPortfolioHeartbeatNativeTurn({
      ...input(),
      send: async (command) => {
        sent.push(command.command.message.text);
        return { accepted: true, sequence: 42 };
      },
    });

    expect(sent).toEqual(["Run one bounded native Heartbeat proof and report the receipt."]);
    expect(dispatched).toMatchObject({
      accepted: true,
      lifecycle: { state: "active", activeRunId: "run-1" },
      receipt: { status: "dispatched", sequence: 42 },
    });
  });

  it("keeps failed and unknown transport outcomes distinct", async () => {
    const failed = await dispatchPortfolioHeartbeatNativeTurn({
      ...input(),
      send: async () => ({ accepted: false, detail: "Target rejected the turn." }),
    });
    expect(failed).toMatchObject({
      lifecycle: { state: "paused", activeRunId: null },
      receipt: { status: "failed", detail: "Target rejected the turn." },
    });

    const uncertain = await dispatchPortfolioHeartbeatNativeTurn({
      ...input(),
      send: async () => {
        throw new Error("connection closed after send");
      },
    });
    expect(uncertain.receipt).toMatchObject({ status: "uncertain" });
  });
});
