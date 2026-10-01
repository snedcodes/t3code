import type { PortfolioTasksReadback } from "@t3tools/contracts";

/** Read-only project snapshot. Other environments/projects never enter voice context. */
export function selectRealtimeTasks(
  readback: PortfolioTasksReadback,
  projectId: string,
  threadId: string,
) {
  const eligible = readback.tasks.filter(
    (task) =>
      task.target.environmentId === readback.ownerEnvironmentId &&
      task.target.projectId === projectId,
  );
  const terminal = (status: string) => status === "complete" || status === "cancelled";
  const ordered = eligible.toSorted(
    (a, b) =>
      Number(terminal(a.status)) - Number(terminal(b.status)) ||
      Number(b.target.threadId === threadId) - Number(a.target.threadId === threadId) ||
      b.updatedAt.localeCompare(a.updatedAt) ||
      a.taskId.localeCompare(b.taskId),
  );
  let truncated = ordered.length > 10;
  let remaining = 16_000;
  const clip = (text: string | null | undefined, cap: number) => {
    if (text == null) return null;
    const included = text.slice(0, Math.min(cap, remaining));
    remaining -= included.length;
    truncated ||= included.length < text.length;
    return included;
  };
  const tasks = ordered.slice(0, 10).map((task) => {
    truncated ||= task.checklistItems.length > 12;
    return {
      taskId: task.taskId,
      revision: task.revision,
      updatedAt: task.updatedAt,
      status: task.status,
      target: task.target,
      title: clip(task.title, 240),
      priority: clip(task.priority, 80),
      outcome: clip(task.outcome, 1_000),
      completionCondition: clip(task.completionCondition, 1_000),
      ownerPassportId: clip(task.ownerPassportId, 120),
      ownerHost: clip(task.ownerHost, 120),
      checklistItems: task.checklistItems.slice(0, 12).map((item) => ({
        itemId: item.itemId,
        state: item.state,
        text: clip(item.text, 400),
        evidence: clip(item.evidence, 600),
        updatedAt: item.updatedAt,
      })),
      lastReceipt: task.lastReceipt && {
        status: task.lastReceipt.status,
        observedAt: task.lastReceipt.observedAt,
        detail: clip(task.lastReceipt.detail, 400),
      },
    };
  });
  return { tasks, truncated };
}
