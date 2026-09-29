import type { PortfolioHeartbeatRecord } from "@t3tools/contracts";

export function formatPortfolioHeartbeatEnvironmentLabel(
  environmentId: string,
  labels: ReadonlyMap<string, string>,
): string {
  return labels.get(environmentId) ?? "Unknown environment";
}

export function formatPortfolioHeartbeatCadence(cadenceMinutes: number | null): string {
  if (cadenceMinutes === null) return "Manual cadence";
  if (cadenceMinutes === 1) return "Every minute";
  return `Every ${cadenceMinutes} minutes`;
}

export function formatPortfolioHeartbeatRuns(
  record: Pick<PortfolioHeartbeatRecord, "runCount" | "maxRuns">,
): string {
  return record.maxRuns === null
    ? `${record.runCount} runs`
    : `${record.runCount}/${record.maxRuns} runs`;
}

export function formatPortfolioHeartbeatNextRun(nextRunAt: string | null | undefined): string {
  return nextRunAt ?? "Not scheduled";
}

export function formatPortfolioHeartbeatUpdatedAt(updatedAt: string): string {
  const timestamp = Date.parse(updatedAt);
  return Number.isNaN(timestamp)
    ? "Time unavailable"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
        timestamp,
      );
}
