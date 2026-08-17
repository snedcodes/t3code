import { ProjectId, ThreadId, TurnId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";
import { buildNativeHeartbeatTargets } from "./portfolioHeartbeatTargets";

const project = (id: string, title: string) =>
  ({
    id: ProjectId.make(id),
    environmentId: "local" as never,
    title,
  }) as never;

const thread = (input: {
  id: string;
  projectId: string;
  title: string;
  updatedAt: string;
  status?: "running" | "starting" | "stopped" | "error";
  archivedAt?: string | null;
}) =>
  ({
    id: ThreadId.make(input.id),
    projectId: ProjectId.make(input.projectId),
    environmentId: "local" as never,
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

describe("buildNativeHeartbeatTargets", () => {
  it("uses native projects and threads as selectable targets", () => {
    const targets = buildNativeHeartbeatTargets(
      [project("project-1", "VoiceToolsSuite")],
      [
        thread({
          id: "thread-1",
          projectId: "project-1",
          title: "Heartbeat work",
          updatedAt: "2026-08-17T02:00:00.000Z",
        }),
      ],
    );

    expect(targets).toHaveLength(1);
    expect(targets[0]).toMatchObject({
      projectTitle: "VoiceToolsSuite",
      threadTitle: "Heartbeat work",
      sessionStatus: null,
      hasActiveTurn: false,
    });
  });

  it("puts running work first, then excludes archived threads", () => {
    const targets = buildNativeHeartbeatTargets(
      [project("project-1", "Project")],
      [
        thread({
          id: "old",
          projectId: "project-1",
          title: "Old",
          updatedAt: "2026-08-17T04:00:00.000Z",
          archivedAt: "2026-08-17T05:00:00.000Z",
        }),
        thread({
          id: "recent",
          projectId: "project-1",
          title: "Recent",
          updatedAt: "2026-08-17T05:00:00.000Z",
          status: "stopped",
        }),
        thread({
          id: "active",
          projectId: "project-1",
          title: "Active",
          updatedAt: "2026-08-17T01:00:00.000Z",
          status: "running",
        }),
      ],
    );

    expect(targets.map((target) => target.threadTitle)).toEqual(["Active", "Recent"]);
    expect(targets[0]?.hasActiveTurn).toBe(true);
  });
});
