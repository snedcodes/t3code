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
