import type {
  EnvironmentProject,
  EnvironmentThreadShell,
} from "@t3tools/client-runtime/state/shell";
import type { OrchestrationSession } from "@t3tools/contracts";

export type NativeMessageTarget = {
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

/** Build selectable exact targets from upstream environment/project/thread shells. */
export function buildNativeMessageTargets(
  projects: ReadonlyArray<EnvironmentProject>,
  threads: ReadonlyArray<EnvironmentThreadShell>,
): ReadonlyArray<NativeMessageTarget> {
  const projectByScopedId = new Map(
    projects.map((project) => [`${project.environmentId}:${project.id}`, project]),
  );

  return threads
    .filter((thread) => thread.archivedAt === null)
    .flatMap((thread) => {
      const project = projectByScopedId.get(`${thread.environmentId}:${thread.projectId}`);
      if (!project) return [];
      return [
        {
          key: JSON.stringify([thread.environmentId, thread.projectId, thread.id]),
          environmentId: thread.environmentId,
          projectId: thread.projectId,
          threadId: thread.id,
          projectTitle: project.title,
          threadTitle: thread.title,
          updatedAt: thread.updatedAt,
          sessionStatus: thread.session?.status ?? null,
          hasActiveTurn: Boolean(thread.session?.activeTurnId),
        },
      ];
    })
    .sort((left, right) => {
      const statusDifference =
        (SESSION_STATUS_ORDER[left.sessionStatus ?? ""] ?? 4) -
        (SESSION_STATUS_ORDER[right.sessionStatus ?? ""] ?? 4);
      if (statusDifference !== 0) return statusDifference;
      return timestampValue(right.updatedAt) - timestampValue(left.updatedAt);
    });
}
