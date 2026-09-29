import { EnvironmentId, ProjectId, ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";
import {
  buildPortfolioRotationRows,
  groupPortfolioRotationRows,
  ROTATION_PROMPT_MAX_CHARACTERS,
  sortPortfolioRotationRows,
  type PortfolioRotationRow,
} from "./portfolioRotation";

const project = {
  environmentId: EnvironmentId.make("env-1"),
  id: ProjectId.make("project-1"),
  title: "Portfolio",
  workspaceRoot: "/work/portfolio",
} as never;
const thread = (id: string) =>
  ({
    environmentId: EnvironmentId.make("env-1"),
    id: ThreadId.make(id),
    projectId: ProjectId.make("project-1"),
    title: "Worker session",
    createdAt: "2026-08-10T00:00:00.000Z",
    updatedAt: "2026-08-17T00:00:00.000Z",
    latestUserMessageAt: null,
    latestTurn: null,
    archivedAt: null,
    session: { status: "stopped", providerName: "Codex", activeTurnId: null },
  }) as never;

const row = (input: {
  id: string;
  projectTitle: string;
  hostLabel: string;
  createdAt: string;
  lastUsedAt: string | null;
  processedTokens?: number | null;
  usedTokens?: number | null;
  rotationState?: PortfolioRotationRow["rotationState"];
}): PortfolioRotationRow =>
  ({
    key: input.id,
    environmentId: EnvironmentId.make("env-1"),
    threadId: ThreadId.make(input.id),
    projectId: ProjectId.make("project-1"),
    sessionTitle: input.id,
    projectTitle: input.projectTitle,
    workspaceRoot: "/work",
    hostLabel: input.hostLabel,
    platform: "darwin",
    createdAt: input.createdAt,
    lastUsedAt: input.lastUsedAt,
    sessionStatus: null,
    worker: null,
    telemetry:
      input.processedTokens !== undefined || input.usedTokens !== undefined
        ? ({
            totalProcessedTokens: input.processedTokens ?? null,
            usedTokens: input.usedTokens ?? 0,
          } as never)
        : null,
    telemetryFreshness: "unknown",
    health: "unavailable",
    rotationState: input.rotationState ?? "Healthy",
    rotationReason: "test",
    lastRotationAt: null,
    role: null,
    standards: [],
    promptPreview: "test",
    promptPreviewVersion: "rotation-prompt-v1",
  }) as unknown as PortfolioRotationRow;

describe("buildPortfolioRotationRows", () => {
  it("derives truthful native identity and threshold state", () => {
    const rows = buildPortfolioRotationRows({
      projects: [project],
      threads: [thread("thread-1")],
      environments: new Map([
        [
          "env-1",
          {
            label: "Mac host",
            platform: { os: "darwin" },
            serverVersion: "0.0.33-alpha",
            connectionStatus: { phase: "connected", error: null, traceId: null },
          },
        ],
      ]),
      telemetryByThread: new Map([
        [
          "env-1:thread-1",
          { totalProcessedTokens: 200_000_000, updatedAt: "2026-08-17T00:00:00.000Z" } as never,
        ],
      ]),
      now: Date.parse("2026-08-17T00:05:00.000Z"),
    });

    expect(rows[0]).toMatchObject({
      projectTitle: "Portfolio",
      hostLabel: "Mac host",
      worker: "Codex",
      connectionStatus: { phase: "connected" },
      serverVersion: "0.0.33-alpha",
      rotationState: "Rotation required",
      telemetryFreshness: "fresh",
      lastRotationAt: null,
    });
  });

  it("bounds the versioned preview and does not invent standards", () => {
    const rows = buildPortfolioRotationRows({
      projects: [project],
      threads: [thread("thread-2")],
      environments: new Map([["env-1", { label: "env-1", platform: null }]]),
      latestPromptByThread: new Map([["env-1:thread-2", "x".repeat(5_000)]]),
    });

    expect(rows[0]?.promptPreview.length).toBeLessThanOrEqual(ROTATION_PROMPT_MAX_CHARACTERS);
    expect(rows[0]?.standards).toEqual([]);
    expect(rows[0]?.promptPreviewVersion).toBe("rotation-prompt-v1");
  });

  it("sorts by attention, activity, creation time, and real telemetry", () => {
    const rows = [
      row({
        id: "healthy",
        projectTitle: "Beta",
        hostLabel: "Remote",
        createdAt: "2026-08-12T00:00:00.000Z",
        lastUsedAt: "2026-08-17T01:00:00.000Z",
        processedTokens: 10,
        usedTokens: 10,
        rotationState: "Healthy",
      }),
      row({
        id: "watch",
        projectTitle: "Alpha",
        hostLabel: "Mac",
        createdAt: "2026-08-11T00:00:00.000Z",
        lastUsedAt: "2026-08-17T02:00:00.000Z",
        processedTokens: 100,
        usedTokens: 100,
        rotationState: "Watch",
      }),
      row({
        id: "required",
        projectTitle: "Gamma",
        hostLabel: "Mac",
        createdAt: "2026-08-13T00:00:00.000Z",
        lastUsedAt: null,
        processedTokens: null,
        usedTokens: null,
        rotationState: "Rotation required",
      }),
    ];

    expect(sortPortfolioRotationRows(rows, "attention").map((item) => item.key)).toEqual([
      "required",
      "watch",
      "healthy",
    ]);
    expect(sortPortfolioRotationRows(rows, "last-used").map((item) => item.key)).toEqual([
      "watch",
      "healthy",
      "required",
    ]);
    expect(sortPortfolioRotationRows(rows, "processed-tokens").map((item) => item.key)).toEqual([
      "watch",
      "healthy",
      "required",
    ]);
    expect(sortPortfolioRotationRows(rows, "oldest").map((item) => item.key)).toEqual([
      "watch",
      "healthy",
      "required",
    ]);
  });

  it("groups rows by project or host without changing row identity", () => {
    const rows = [
      row({
        id: "one",
        projectTitle: "Beta",
        hostLabel: "Mac",
        createdAt: "2026-08-10T00:00:00.000Z",
        lastUsedAt: null,
      }),
      {
        ...row({
          id: "two",
          projectTitle: "Alpha",
          hostLabel: "Mac",
          createdAt: "2026-08-11T00:00:00.000Z",
          lastUsedAt: null,
        }),
        projectId: ProjectId.make("project-2"),
      },
    ];

    expect(groupPortfolioRotationRows(rows, "project").map((group) => group.label)).toEqual([
      "Alpha",
      "Beta",
    ]);
    expect(groupPortfolioRotationRows(rows, "host")).toMatchObject([
      { label: "Mac", rows: [{ key: "one" }, { key: "two" }] },
    ]);
  });

  it("keeps same-named native projects and environments in separate groups", () => {
    const sameNamedRows = [
      {
        ...row({
          id: "env-1-thread",
          projectTitle: "Portfolio",
          hostLabel: "Windows",
          createdAt: "2026-08-10T00:00:00.000Z",
          lastUsedAt: null,
        }),
        environmentId: EnvironmentId.make("env-1"),
        projectId: ProjectId.make("project-1"),
      },
      {
        ...row({
          id: "env-2-thread",
          projectTitle: "Portfolio",
          hostLabel: "Windows",
          createdAt: "2026-08-11T00:00:00.000Z",
          lastUsedAt: null,
        }),
        environmentId: EnvironmentId.make("env-2"),
        projectId: ProjectId.make("project-2"),
      },
    ] as ReadonlyArray<PortfolioRotationRow>;

    expect(groupPortfolioRotationRows(sameNamedRows, "project")).toHaveLength(2);
    expect(groupPortfolioRotationRows(sameNamedRows, "host")).toHaveLength(2);
  });
});
