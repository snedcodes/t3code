import type { PortfolioTask } from "@t3tools/contracts";

export function formatPortfolioTaskEnvironmentLabel(
  environmentId: string,
  labels: ReadonlyMap<string, string>,
): string {
  return labels.get(environmentId) ?? "Unknown environment";
}

export function formatPortfolioTaskAssignedAgent(task: PortfolioTask): string {
  return task.assignment.ownerHost ?? task.assignment.ownerPassportId ?? "Unassigned agent";
}

export function formatPortfolioTaskChecklistProgress(task: PortfolioTask): string {
  const completed = task.checklistItems.filter((item) => item.state === "complete").length;
  return `${completed}/${task.checklistItems.length}`;
}

export function formatPortfolioTaskUpdatedAt(value: string): string {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp)
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
        timestamp,
      )
    : "Updated time unavailable";
}

export function formatPortfolioTaskNotification(task: PortfolioTask): string {
  const incomplete = task.checklistItems
    .filter((item) => item.state !== "complete")
    .map((item) => `- [${item.state}] ${item.text}`)
    .join("\n");
  return [
    `Continue Task "${task.title}" (Task ID: ${task.taskId}).`,
    `Outcome: ${task.outcome}`,
    `Incomplete checklist:\n${incomplete || "- None; verify the completion condition."}`,
    "Update the canonical Task checklist and evidence as the work changes.",
    `Completion condition: ${task.completionCondition}`,
  ].join("\n\n");
}
