import { ProjectId, ThreadId, TurnId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";
import { buildNativeMessageTargets } from "./nativeMessageTargets";

const project = (environmentId: string, id: string, title: string) =>
  ({ environmentId, id: ProjectId.make(id), title }) as never;

const thread = (input: {
  environmentId: string;
  id: string;
  projectId: string;
  title: string;
  updatedAt: string;
  status?: "running" | "starting" | "stopped" | "error";
  archivedAt?: string | null;
}) =>
  ({
    environmentId: input.environmentId,
    id: ThreadId.make(input.id),
    projectId: ProjectId.make(input.projectId),
    title: input.title,
    updatedAt: input.updatedAt,
    archivedAt: input.archivedAt ?? null,
    session: input.status
      ? {
          status: input.status,
          activeTurnId: input.status === "running" ? TurnId.make("turn") : null,
        }
      : null,
  }) as never;

describe("buildNativeMessageTargets", () => {
  it("keeps exact environment/project/thread identity and omits archived or unresolved targets", () => {
    const targets = buildNativeMessageTargets(
      [project("vps", "same-project", "VPS project"), project("mac", "same-project", "Mac project")],
      [
        thread({
          environmentId: "vps",
          id: "same-thread",
          projectId: "same-project",
          title: "VPS thread",
          updatedAt: "2026-09-28T02:00:00.000Z",
        }),
        thread({
          environmentId: "mac",
          id: "same-thread",
          projectId: "same-project",
          title: "Mac thread",
          updatedAt: "2026-09-28T01:00:00.000Z",
        }),
        thread({
          environmentId: "vps",
          id: "archived",
          projectId: "same-project",
          title: "Archived",
          updatedAt: "2026-09-28T03:00:00.000Z",
          archivedAt: "2026-09-28T04:00:00.000Z",
        }),
        thread({
          environmentId: "vps",
          id: "orphan",
          projectId: "missing-project",
          title: "Unresolved project",
          updatedAt: "2026-09-28T05:00:00.000Z",
        }),
      ],
    );

    expect(targets.map(({ environmentId, projectId, threadId, projectTitle, threadTitle }) => ({
      environmentId,
      projectId,
      threadId,
      projectTitle,
      threadTitle,
    }))).toEqual([
      {
        environmentId: "vps",
        projectId: "same-project",
        threadId: "same-thread",
        projectTitle: "VPS project",
        threadTitle: "VPS thread",
      },
      {
        environmentId: "mac",
        projectId: "same-project",
        threadId: "same-thread",
        projectTitle: "Mac project",
        threadTitle: "Mac thread",
      },
    ]);
    expect(targets[0]?.key).not.toBe(targets[1]?.key);
  });

  it("prioritizes active sessions and then most recently updated targets", () => {
    const targets = buildNativeMessageTargets(
      [project("local", "project", "Project")],
      [
        thread({
          environmentId: "local",
          id: "recent",
          projectId: "project",
          title: "Recent",
          updatedAt: "2026-09-28T05:00:00.000Z",
          status: "stopped",
        }),
        thread({
          environmentId: "local",
          id: "active",
          projectId: "project",
          title: "Active",
          updatedAt: "2026-09-28T01:00:00.000Z",
          status: "running",
        }),
      ],
    );

    expect(targets.map((target) => target.threadTitle)).toEqual(["Active", "Recent"]);
    expect(targets[0]?.hasActiveTurn).toBe(true);
  });
});
