import type {
  EnvironmentProject,
  EnvironmentThreadShell,
} from "@t3tools/client-runtime/state/shell";
import type { OrchestrationSession } from "@t3tools/contracts";

export type NativeHeartbeatTarget = {
  readonly key: string;
  readonly environmentId: EnvironmentThreadShell["environmentId"];
  readonly projectId: EnvironmentThreadShell["projectId"];
  readonly threadId: EnvironmentThreadShell["id"];
  readonly projectTitle: string;
  readonly threadTitle: string;
  readonly updatedAt: string;
  readonly sessionStatus: OrchestrationSession["status"] | null;
  readonly hasActiveTurn: boolean;
};

const SESSION_STATUS_ORDER: Readonly<Record<string, number>> = {
  running: 0,
  starting: 1,
  stopped: 2,
  error: 3,
};

function timestampValue(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Builds the paused Heartbeat target list from the native T3 shell projection.
 * This is intentionally a pure view model: it does not persist, schedule, or
 * dispatch anything and it does not create another session registry.
 */
export function buildNativeHeartbeatTargets(
  projects: ReadonlyArray<EnvironmentProject>,
  threads: ReadonlyArray<EnvironmentThreadShell>,
): ReadonlyArray<NativeHeartbeatTarget> {
  const projectTitles = new Map(
    projects.map((project) => [`${project.environmentId}:${project.id}`, project.title]),
  );

  return threads
    .filter((thread) => thread.archivedAt === null)
    .map((thread) => ({
      key: `${thread.environmentId}:${thread.id}`,
      environmentId: thread.environmentId,
      projectId: thread.projectId,
      threadId: thread.id,
      projectTitle:
        projectTitles.get(`${thread.environmentId}:${thread.projectId}`) ?? "Unknown project",
      threadTitle: thread.title,
      updatedAt: thread.updatedAt,
      sessionStatus: thread.session?.status ?? null,
      hasActiveTurn: Boolean(thread.session?.activeTurnId),
    }))
    .sort((left, right) => {
      const statusDifference =
        (SESSION_STATUS_ORDER[left.sessionStatus ?? ""] ?? 4) -
        (SESSION_STATUS_ORDER[right.sessionStatus ?? ""] ?? 4);
      if (statusDifference !== 0) return statusDifference;

      const updatedDifference = timestampValue(right.updatedAt) - timestampValue(left.updatedAt);
      if (updatedDifference !== 0) return updatedDifference;
      return left.threadTitle.localeCompare(right.threadTitle);
    });
}
