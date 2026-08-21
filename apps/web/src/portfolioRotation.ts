import type {
  EnvironmentProject,
  EnvironmentThreadShell,
} from "@t3tools/client-runtime/state/shell";
import type { EnvironmentConnectionPresentation } from "@t3tools/client-runtime/connection";
import type { OrchestrationMessage, OrchestrationSession } from "@t3tools/contracts";
import {
  classifyContextRotationHealth,
  type ContextRotationHealth,
} from "./portfolioContextHealth";
import type { ContextWindowSnapshot } from "./lib/contextWindow";

export const ROTATION_PROMPT_VERSION = "rotation-prompt-v1";
export const ROTATION_PROMPT_MAX_CHARACTERS = 1_200;

export type PortfolioRotationSort =
  | "attention"
  | "last-used"
  | "newest"
  | "oldest"
  | "processed-tokens"
  | "context-used"
  | "project"
  | "host";

export type PortfolioRotationGrouping = "none" | "project" | "host";

export const PORTFOLIO_ROTATION_SORT_OPTIONS: ReadonlyArray<{
  readonly value: PortfolioRotationSort;
  readonly label: string;
}> = [
  { value: "attention", label: "Attention" },
  { value: "last-used", label: "Last used" },
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "processed-tokens", label: "Processed tokens" },
  { value: "context-used", label: "Context used" },
  { value: "project", label: "Project" },
  { value: "host", label: "Host / environment" },
];

export const PORTFOLIO_ROTATION_GROUPING_OPTIONS: ReadonlyArray<{
  readonly value: PortfolioRotationGrouping;
  readonly label: string;
}> = [
  { value: "none", label: "None" },
  { value: "project", label: "Project" },
  { value: "host", label: "Host / environment" },
];

export type RotationStandardsLink = {
  readonly label: string;
  readonly path: string;
  readonly revision: string | null;
};

export type PortfolioRotationRow = {
  readonly key: string;
  readonly environmentId: EnvironmentThreadShell["environmentId"];
  readonly threadId: EnvironmentThreadShell["id"];
  readonly projectId: EnvironmentThreadShell["projectId"];
  readonly sessionTitle: string;
  readonly projectTitle: string;
  readonly workspaceRoot: string;
  readonly hostLabel: string;
  readonly platform: string | null;
  readonly serverVersion: string | null;
  readonly connectionStatus: EnvironmentConnectionPresentation | null;
  readonly createdAt: string;
  readonly lastUsedAt: string | null;
  readonly sessionStatus: OrchestrationSession["status"] | null;
  readonly worker: string | null;
  readonly telemetry: ContextWindowSnapshot | null;
  readonly telemetryFreshness: "fresh" | "stale" | "unknown";
  readonly health: ContextRotationHealth;
  readonly rotationState: "Healthy" | "Watch" | "Rotation required" | "Unavailable";
  readonly rotationReason: string;
  readonly lastRotationAt: string | null;
  readonly role: string | null;
  readonly standards: ReadonlyArray<RotationStandardsLink>;
  readonly promptPreview: string;
  readonly promptPreviewVersion: typeof ROTATION_PROMPT_VERSION;
};

type RotationEnvironment = {
  readonly label: string;
  readonly platform: { readonly os: string } | null;
  readonly serverVersion?: string;
  readonly connectionStatus?: EnvironmentConnectionPresentation;
};

function freshness(
  updatedAt: string | null,
  now: number,
): PortfolioRotationRow["telemetryFreshness"] {
  if (!updatedAt) return "unknown";
  const timestamp = Date.parse(updatedAt);
  if (!Number.isFinite(timestamp) || !Number.isFinite(now)) return "unknown";
  return Math.max(0, now - timestamp) <= 15 * 60_000 ? "fresh" : "stale";
}

function latestTimestamp(candidates: ReadonlyArray<string | null | undefined>): string | null {
  let latest: string | null = null;
  let latestMilliseconds = Number.NEGATIVE_INFINITY;
  for (const candidate of candidates) {
    if (!candidate) continue;
    const milliseconds = Date.parse(candidate);
    if (Number.isFinite(milliseconds) && milliseconds > latestMilliseconds) {
      latest = candidate;
      latestMilliseconds = milliseconds;
    }
  }
  return latest;
}

function timestampMilliseconds(value: string | null): number | null {
  if (!value) return null;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) ? milliseconds : null;
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, undefined, { sensitivity: "base" });
}

function compareDescendingNullable(left: number | null, right: number | null): number {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return right - left;
}

function compareAscendingNullable(left: number | null, right: number | null): number {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return left - right;
}

function attentionRank(row: PortfolioRotationRow): number {
  switch (row.rotationState) {
    case "Rotation required":
      return 0;
    case "Watch":
      return 1;
    case "Unavailable":
      return 2;
    case "Healthy":
      return 3;
  }
}

function stableTieBreak(left: PortfolioRotationRow, right: PortfolioRotationRow): number {
  return (
    compareText(left.projectTitle, right.projectTitle) ||
    compareText(left.hostLabel, right.hostLabel) ||
    compareText(left.sessionTitle, right.sessionTitle) ||
    left.key.localeCompare(right.key)
  );
}

export function sortPortfolioRotationRows(
  rows: ReadonlyArray<PortfolioRotationRow>,
  sort: PortfolioRotationSort = "attention",
): ReadonlyArray<PortfolioRotationRow> {
  return [...rows].toSorted((left, right) => {
    let result: number;
    switch (sort) {
      case "attention":
        result =
          attentionRank(left) - attentionRank(right) ||
          compareDescendingNullable(
            timestampMilliseconds(left.lastUsedAt),
            timestampMilliseconds(right.lastUsedAt),
          );
        break;
      case "last-used":
        result = compareDescendingNullable(
          timestampMilliseconds(left.lastUsedAt),
          timestampMilliseconds(right.lastUsedAt),
        );
        break;
      case "newest":
        result = compareDescendingNullable(
          timestampMilliseconds(left.createdAt),
          timestampMilliseconds(right.createdAt),
        );
        break;
      case "oldest":
        result = compareAscendingNullable(
          timestampMilliseconds(left.createdAt),
          timestampMilliseconds(right.createdAt),
        );
        break;
      case "processed-tokens":
        result = compareDescendingNullable(
          left.telemetry?.totalProcessedTokens ?? null,
          right.telemetry?.totalProcessedTokens ?? null,
        );
        break;
      case "context-used":
        result = compareDescendingNullable(
          left.telemetry?.usedTokens ?? null,
          right.telemetry?.usedTokens ?? null,
        );
        break;
      case "project":
        result = compareText(left.projectTitle, right.projectTitle);
        break;
      case "host":
        result = compareText(left.hostLabel, right.hostLabel);
        break;
    }
    return result || stableTieBreak(left, right);
  });
}

export type PortfolioRotationGroup = {
  readonly key: string;
  readonly label: string;
  readonly rows: ReadonlyArray<PortfolioRotationRow>;
};

export function groupPortfolioRotationRows(
  rows: ReadonlyArray<PortfolioRotationRow>,
  grouping: PortfolioRotationGrouping,
): ReadonlyArray<PortfolioRotationGroup> {
  if (grouping === "none") {
    return [{ key: "all", label: "All rotations", rows }];
  }
  const groups = new Map<string, { label: string; rows: PortfolioRotationRow[] }>();
  for (const row of rows) {
    const label = grouping === "project" ? row.projectTitle : row.hostLabel;
    const identity =
      grouping === "project" ? `${row.environmentId}:${row.projectId}` : String(row.environmentId);
    const key = `${grouping}:${identity}`;
    const group = groups.get(key);
    if (group) group.rows.push(row);
    else groups.set(key, { label, rows: [row] });
  }
  return [...groups.entries()]
    .sort((left, right) => compareText(left[1].label, right[1].label))
    .map(([key, group]) => ({ key, label: group.label, rows: group.rows }));
}

function promptPreview(input: {
  readonly sessionTitle: string;
  readonly projectTitle: string;
  readonly hostLabel: string;
  readonly reason: string;
  readonly latestUserPrompt: string | null;
  readonly standards: ReadonlyArray<RotationStandardsLink>;
}): string {
  const standards =
    input.standards.length > 0
      ? input.standards
          .map((link) => `${link.label}: ${link.path}@${link.revision ?? "unknown"}`)
          .join("; ")
      : "No role or standards record is linked in native T3.";
  const sourcePrompt = input.latestUserPrompt
    ? `Latest user prompt (context only): ${input.latestUserPrompt}`
    : "Latest user prompt is not hydrated in this view.";
  const value = [
    `Prepare a read-only rotation review for ${input.sessionTitle}.`,
    `Project: ${input.projectTitle}. Host/environment: ${input.hostLabel}.`,
    `Reason: ${input.reason}`,
    `Read the current role and standards before proposing any successor. Links: ${standards}`,
    sourcePrompt,
    "Do not dispatch, create, rename, archive, or cut over an agent. Return a bounded handoff proposal and receipts needed for review.",
  ].join("\n");
  return value.length <= ROTATION_PROMPT_MAX_CHARACTERS
    ? value
    : `${value.slice(0, ROTATION_PROMPT_MAX_CHARACTERS - 1)}…`;
}

export function buildPortfolioRotationRows(input: {
  readonly projects: ReadonlyArray<EnvironmentProject>;
  readonly threads: ReadonlyArray<EnvironmentThreadShell>;
  readonly environments: ReadonlyMap<string, RotationEnvironment>;
  readonly telemetryByThread?: ReadonlyMap<string, ContextWindowSnapshot | null>;
  readonly latestPromptByThread?: ReadonlyMap<string, string | null>;
  readonly now?: number;
}): ReadonlyArray<PortfolioRotationRow> {
  const projectByKey = new Map(
    input.projects.map((project) => [`${project.environmentId}:${project.id}`, project]),
  );
  const now = input.now ?? Date.now();

  return input.threads
    .filter((thread) => thread.archivedAt === null)
    .map((thread) => {
      const key = `${thread.environmentId}:${thread.id}`;
      const project = projectByKey.get(`${thread.environmentId}:${thread.projectId}`);
      const environment = input.environments.get(String(thread.environmentId));
      const telemetry = input.telemetryByThread?.get(key) ?? null;
      const health = classifyContextRotationHealth(telemetry?.totalProcessedTokens);
      const rotationState =
        health === "rotation-required"
          ? "Rotation required"
          : health === "watch"
            ? "Watch"
            : health === "normal"
              ? "Healthy"
              : "Unavailable";
      const rotationReason =
        health === "rotation-required"
          ? "Processed-token telemetry has reached the native rotation threshold."
          : health === "watch"
            ? "Processed-token telemetry is in the native watch range."
            : health === "normal"
              ? "Native telemetry is below the rotation watch threshold."
              : "Native context/token telemetry is unavailable; no rotation need is inferred.";
      const standards: ReadonlyArray<RotationStandardsLink> = [];
      const hostLabel = environment?.label ?? String(thread.environmentId);
      return {
        key,
        environmentId: thread.environmentId,
        threadId: thread.id,
        projectId: thread.projectId,
        sessionTitle: thread.title,
        projectTitle: project?.title ?? "Unknown project",
        workspaceRoot: project?.workspaceRoot ?? "Unknown workspace",
        hostLabel,
        platform: environment?.platform?.os ?? null,
        serverVersion: environment?.serverVersion ?? null,
        connectionStatus: environment?.connectionStatus ?? null,
        createdAt: thread.createdAt,
        lastUsedAt: latestTimestamp([
          thread.latestUserMessageAt,
          thread.latestTurn?.requestedAt,
          thread.latestTurn?.startedAt,
          thread.latestTurn?.completedAt,
          thread.updatedAt,
        ]),
        sessionStatus: thread.session?.status ?? null,
        worker: thread.session?.providerName ?? null,
        telemetry,
        telemetryFreshness: freshness(telemetry?.updatedAt ?? null, now),
        health,
        rotationState,
        rotationReason,
        lastRotationAt: null,
        role: null,
        standards,
        promptPreview: promptPreview({
          sessionTitle: thread.title,
          projectTitle: project?.title ?? "Unknown project",
          hostLabel,
          reason: rotationReason,
          latestUserPrompt: input.latestPromptByThread?.get(key) ?? null,
          standards,
        }),
        promptPreviewVersion: ROTATION_PROMPT_VERSION,
      } satisfies PortfolioRotationRow;
    });
}

export function latestUserPrompt(messages: ReadonlyArray<OrchestrationMessage>): string | null {
  return [...messages].reverse().find((message) => message.role === "user")?.text ?? null;
}
