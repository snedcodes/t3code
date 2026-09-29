import { EnvironmentId, ProjectId, ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  buildReviewedPortfolioRotationRequest,
  PORTFOLIO_ROTATION_REQUEST_MAX_CHARACTERS,
  PORTFOLIO_ROTATION_REQUEST_VERSION,
} from "./portfolioRotationRequest";
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
    hostLabel: "VPS Dev",
    platform: "windows",
    serverVersion: "0.0.33",
    connectionStatus: null,
    createdAt: "2026-08-24T00:00:00.000Z",
    lastUsedAt: "2026-08-24T01:00:00.000Z",
    sessionStatus: "stopped",
    worker: "Codex",
    telemetry: null,
    telemetryFreshness: "unknown",
    health: "unavailable",
    rotationState: "Rotation required",
    rotationReason: "Processed-token telemetry has reached the native rotation threshold.",
    lastRotationAt: null,
    role: "worker",
    standards: [{ label: "Rotation standard", path: "docs/rotation.md", revision: "abc123" }],
    promptPreview: "review",
    promptPreviewVersion: "rotation-prompt-v1",
    ...overrides,
  };
}

describe("buildReviewedPortfolioRotationRequest", () => {
  it("requires an explicit review before preparing a native request", () => {
    expect(buildReviewedPortfolioRotationRequest({ row: row(), reviewed: false })).toEqual({
      ok: false,
      reason: "explicit-review-required",
    });
  });

  it("keeps the exact native target and emits one bounded reviewed request", () => {
    const result = buildReviewedPortfolioRotationRequest({ row: row(), reviewed: true });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.request).toMatchObject({
      version: PORTFOLIO_ROTATION_REQUEST_VERSION,
      action: "rotate",
      reviewed: true,
      target: {
        environmentId: EnvironmentId.make("env-1"),
        projectId: ProjectId.make("project-1"),
        threadId: ThreadId.make("thread-1"),
      },
      worker: "Codex",
      role: "worker",
      promptPreviewVersion: "rotation-prompt-v1",
    });
    expect(result.request.prompt.length).toBeLessThanOrEqual(
      PORTFOLIO_ROTATION_REQUEST_MAX_CHARACTERS,
    );
    expect(result.request.prompt).toContain("Do not create a successor");
    expect(result.request.prompt).toContain("return one bounded rotation decision");
  });

  it("preserves unavailable role, worker, and standards values", () => {
    const result = buildReviewedPortfolioRotationRequest({
      row: row({ worker: null, role: null, standards: [] }),
      reviewed: true,
    });

    expect(result).toMatchObject({
      ok: true,
      request: { worker: null, role: null, standards: [] },
    });
    if (result.ok) {
      expect(result.request.prompt).toContain("Worker: unavailable. Role: unavailable.");
      expect(result.request.prompt).toContain("Standards: unavailable");
    }
  });
});
