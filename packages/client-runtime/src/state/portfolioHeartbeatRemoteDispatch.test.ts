import { CommandId, EnvironmentId, MessageId, ProjectId, ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  buildPortfolioHeartbeatRemoteTurn,
  formatPortfolioHeartbeatRemoteFailure,
  isPortfolioHeartbeatDue,
} from "./portfolioHeartbeatRemoteDispatch.ts";

const record = {
  heartbeatId: "heartbeat-mac-1",
  taskId: null,
  nextRunAt: "2026-08-26T00:00:00.000Z",
  target: {
    environmentId: EnvironmentId.make("mac"),
    projectId: ProjectId.make("project-native"),
    threadId: ThreadId.make("thread-worker"),
  },
  enabled: true,
  activeRunId: null,
  disabledReason: null,
  cadenceMinutes: 30,
  maxRuns: 3,
  runCount: 1,
  expiresAt: null,
  finishLine: null,
  stopConditions: ["Operator stops the Heartbeat"],
  preventOverlap: true,
  lastReceipt: null,
  updatedAt: "2026-08-25T23:00:00.000Z",
};

describe("Portfolio remote Heartbeat dispatch", () => {
  it("builds one due VPS-owned turn for the exact Mac target", () => {
    expect(isPortfolioHeartbeatDue(record, "2026-08-26T00:01:00.000Z")).toBe(true);
    expect(
      buildPortfolioHeartbeatRemoteTurn({
        ownerEnvironmentId: EnvironmentId.make("vps"),
        record,
        task: null,
        commandId: CommandId.make("heartbeat-mac-1-run-2"),
        messageId: MessageId.make("heartbeat-mac-1-run-2-message"),
        createdAt: "2026-08-26T00:01:00.000Z",
      }),
    ).toMatchObject({
      ownerEnvironmentId: EnvironmentId.make("vps"),
      target: record.target,
      commandId: CommandId.make("heartbeat-mac-1-run-2"),
      message: expect.stringContaining("heartbeat-mac-1"),
    });
  });

  it("uses the saved custom message verbatim and retains the generic fallback", () => {
    const input = {
      ownerEnvironmentId: EnvironmentId.make("vps"),
      task: null,
      commandId: CommandId.make("heartbeat-mac-1-run-2"),
      messageId: MessageId.make("heartbeat-mac-1-run-2-message"),
      createdAt: "2026-08-26T00:01:00.000Z",
    };

    expect(
      buildPortfolioHeartbeatRemoteTurn({
        ...input,
        record: { ...record, message: "Continue the exact deployment task." },
      }).message,
    ).toBe("Continue the exact deployment task.");
    expect(
      buildPortfolioHeartbeatRemoteTurn({ ...input, record: { ...record, message: null } }).message,
    ).toContain("heartbeat-mac-1");
  });

  it("preserves the native failure detail for a rejected remote turn", () => {
    expect(
      formatPortfolioHeartbeatRemoteFailure({
        _tag: "EnvironmentConnectionError",
        message: "Mac environment is offline",
      }),
    ).toBe(
      "Remote native Heartbeat rejected (EnvironmentConnectionError): Mac environment is offline",
    );
  });
});
