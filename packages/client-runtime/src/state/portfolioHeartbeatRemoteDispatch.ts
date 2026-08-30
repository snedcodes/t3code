import type {
  CommandId,
  MessageId,
  PortfolioHeartbeatRecord,
  PortfolioTask,
  PortfolioTarget,
} from "@t3tools/contracts";

export type PortfolioHeartbeatRemoteTurn = {
  readonly ownerEnvironmentId: PortfolioTarget["environmentId"];
  readonly target: PortfolioTarget;
  readonly commandId: CommandId;
  readonly messageId: MessageId;
  readonly message: string;
  readonly createdAt: string;
};

export function isPortfolioHeartbeatDue(record: PortfolioHeartbeatRecord, now: string): boolean {
  if (record.status !== "paused" || record.nextRunAt === undefined || record.nextRunAt === null) {
    return false;
  }
  const dueAt = Date.parse(record.nextRunAt);
  const current = Date.parse(now);
  return Number.isFinite(dueAt) && Number.isFinite(current) && dueAt <= current;
}

export function formatPortfolioHeartbeatRemoteFailure(failure: unknown): string {
  if (typeof failure === "object" && failure !== null) {
    const tag = "_tag" in failure && typeof failure._tag === "string" ? failure._tag : null;
    const message =
      "message" in failure && typeof failure.message === "string" ? failure.message : null;
    const detail =
      "detail" in failure && typeof failure.detail === "string" ? failure.detail : null;
    const description = message ?? detail;
    if (tag && description) return `Remote native Heartbeat rejected (${tag}): ${description}`;
    if (tag) return `Remote native Heartbeat rejected (${tag}).`;
    if (description) return `Remote native Heartbeat rejected: ${description}`;
    try {
      const serialized = JSON.stringify(failure);
      if (serialized && serialized !== "{}")
        return `Remote native Heartbeat rejected: ${serialized}`;
    } catch {
      // Fall through to the stable string representation below.
    }
  }
  return `Remote native Heartbeat rejected: ${String(failure)}`;
}

export function buildPortfolioHeartbeatRemoteTurn(input: {
  readonly ownerEnvironmentId: PortfolioTarget["environmentId"];
  readonly record: PortfolioHeartbeatRecord;
  readonly task: PortfolioTask | null;
  readonly commandId: CommandId;
  readonly messageId: MessageId;
  readonly createdAt: string;
}): PortfolioHeartbeatRemoteTurn {
  return {
    ownerEnvironmentId: input.ownerEnvironmentId,
    target: input.record.target,
    commandId: input.commandId,
    messageId: input.messageId,
    message:
      input.record.message?.trim() ||
      (input.task
        ? `Continue Task "${input.task.title}" (Task ID: ${input.task.taskId}).\n\nOutcome: ${input.task.outcome}\n\nCompletion condition: ${input.task.completionCondition}`
        : `Run standalone Heartbeat "${input.record.heartbeatId}" for its exact native target and report one bounded result.`),
    createdAt: input.createdAt,
  };
}
