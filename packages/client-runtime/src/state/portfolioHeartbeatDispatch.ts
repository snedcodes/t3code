import type { PortfolioHeartbeat, PortfolioTask } from "@t3tools/contracts";

export function isPortfolioHeartbeatDue(heartbeat: PortfolioHeartbeat, now: string): boolean {
  if (heartbeat.status !== "active" || heartbeat.nextRunAt === null) return false;
  const dueAt = Date.parse(heartbeat.nextRunAt);
  const current = Date.parse(now);
  return Number.isFinite(dueAt) && Number.isFinite(current) && dueAt <= current;
}

export function buildPortfolioHeartbeatPrompt(heartbeat: PortfolioHeartbeat, task: PortfolioTask | null): string {
  if (heartbeat.message?.trim()) return heartbeat.message.trim();
  if (task === null) return `Run standalone Heartbeat "${heartbeat.heartbeatId}" for its exact native target and report one bounded result.`;
  const incomplete = task.checklistItems.filter((item) => item.state !== "complete").map((item) => `- [${item.state}] ${item.text}`).join("\n");
  return [`Continue Task "${task.title}" (${task.taskId}).`, `Outcome: ${task.outcome}`, `Incomplete checklist:\n${incomplete || "- None; verify the completion condition."}`, `Completion condition: ${task.completionCondition}`, `When complete, update Task ${task.taskId} and stop Heartbeat ${heartbeat.heartbeatId}.`].join("\n\n");
}
