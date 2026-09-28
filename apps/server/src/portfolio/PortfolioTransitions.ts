import type { PortfolioHeartbeat, PortfolioTask } from "@t3tools/contracts";

export function stopHeartbeatForTerminalTask(
  heartbeat: PortfolioHeartbeat,
  task: PortfolioTask,
): PortfolioHeartbeat | null {
  if (task.heartbeatId !== heartbeat.heartbeatId || !["complete", "blocked", "cancelled"].includes(task.status)) return null;
  if (heartbeat.status === "stopped" || heartbeat.status === "completed") return null;
  return {
    ...heartbeat,
    status: task.status === "complete" ? "completed" : "stopped",
    nextRunAt: null,
    stopReason: `Linked Task ${task.status}.`,
    revision: heartbeat.revision + 1,
    updatedAt: task.updatedAt,
  };
}

export function stopHeartbeatForTaskUnlink(
  heartbeat: PortfolioHeartbeat,
  taskId: PortfolioTask["taskId"],
  updatedAt: string,
): PortfolioHeartbeat | null {
  if (heartbeat.taskId !== taskId || heartbeat.status === "stopped" || heartbeat.status === "completed") return null;
  return {
    ...heartbeat,
    status: "stopped",
    nextRunAt: null,
    stopReason: "Linked Task Heartbeat changed.",
    revision: heartbeat.revision + 1,
    updatedAt,
  };
}
