import { EnvironmentId, ProjectId, ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  PORTFOLIO_ROTATION_READ_ONLY_ACTION_POLICY,
  resolvePortfolioRotationAuthority,
} from "./portfolioRotationAuthority";
import type { PortfolioRotationRow } from "./portfolioRotation";

function row(overrides: Partial<PortfolioRotationRow> = {}): PortfolioRotationRow {
  return {
    key: "env-1:thread-1",
    environmentId: EnvironmentId.make("env-1"),
    threadId: ThreadId.make("thread-1"),
    projectId: ProjectId.make("project-1"),
    sessionTitle: "Worker session",
    projectTitle: "Portfolio",
    workspaceRoot: "/work/portfolio",
    hostLabel: "Mac",
    platform: "darwin",
    serverVersion: "0.0.33",
    connectionStatus: null,
    createdAt: "2026-08-17T00:00:00.000Z",
    lastUsedAt: null,
    sessionStatus: "stopped",
    worker: "Codex",
    telemetry: null,
    telemetryFreshness: "unknown",
    health: "unavailable",
    rotationState: "Unavailable",
    rotationReason: "Telemetry unavailable.",
    lastRotationAt: null,
    role: "primary-worker",
    standards: [{ label: "Role standard", path: "docs/role.md", revision: "abc123" }],
    promptPreview: "Prepare a read-only review.",
    promptPreviewVersion: "rotation-prompt-v1",
    ...overrides,
  };
}

describe("resolvePortfolioRotationAuthority", () => {
  it("returns native worker identity, role, standards, and preview version", () => {
    expect(resolvePortfolioRotationAuthority(row())).toEqual({
      workerIdentity: {
        key: "env-1:thread-1",
        environmentId: EnvironmentId.make("env-1"),
        projectId: ProjectId.make("project-1"),
        threadId: ThreadId.make("thread-1"),
        worker: "Codex",
      },
      roleAvailability: { role: "primary-worker", available: true },
      standards: [{ label: "Role standard", path: "docs/role.md", revision: "abc123" }],
      promptPreviewVersion: "rotation-prompt-v1",
      actionPolicy: PORTFOLIO_ROTATION_READ_ONLY_ACTION_POLICY,
    });
  });

  it("preserves unavailable worker, role, standards, and version values", () => {
    const unavailable = row({
      worker: null,
      role: null,
      standards: [],
      promptPreviewVersion: "rotation-prompt-v1",
    });

    expect(resolvePortfolioRotationAuthority(unavailable)).toMatchObject({
      workerIdentity: {
        key: "env-1:thread-1",
        worker: null,
      },
      roleAvailability: { role: null, available: false },
      standards: [],
      promptPreviewVersion: "rotation-prompt-v1",
    });
  });

  it("keeps every mutation and handoff action disabled", () => {
    const policy = resolvePortfolioRotationAuthority(row()).actionPolicy;

    expect(policy).toEqual({
      rotate: { enabled: false, reason: "read-only" },
      createSuccessor: { enabled: false, reason: "read-only" },
      rename: { enabled: false, reason: "read-only" },
      archive: { enabled: false, reason: "read-only" },
      handoff: { enabled: false, reason: "read-only" },
      cutover: { enabled: false, reason: "read-only" },
    });
  });
});
