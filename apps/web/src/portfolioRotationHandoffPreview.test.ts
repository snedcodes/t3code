import type { EnvironmentId, ProjectId, ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { ROTATION_PROMPT_MAX_CHARACTERS } from "./portfolioRotation";
import {
  PORTFOLIO_ROTATION_READ_ONLY_ACTION_POLICY,
  type PortfolioRotationAuthority,
} from "./portfolioRotationAuthority";
import {
  buildPortfolioRotationHandoffPreview,
  PORTFOLIO_ROTATION_HANDOFF_PROPOSAL_MAX_CHARACTERS,
  PORTFOLIO_ROTATION_HANDOFF_PROPOSAL_VERSION,
} from "./portfolioRotationHandoffPreview";

const environmentId = (value: string) => value as EnvironmentId;
const projectId = (value: string) => value as ProjectId;
const threadId = (value: string) => value as ThreadId;

function authority(
  overrides: Partial<PortfolioRotationAuthority> = {},
): PortfolioRotationAuthority {
  return {
    workerIdentity: {
      key: "env-1:thread-1",
      environmentId: environmentId("env-1"),
      projectId: projectId("project-1"),
      threadId: threadId("thread-1"),
      worker: "Codex",
    },
    roleAvailability: { role: "primary-worker", available: true },
    standards: [{ label: "Role standard", path: "docs/role.md", revision: "abc123" }],
    promptPreviewVersion: "rotation-prompt-v1",
    actionPolicy: PORTFOLIO_ROTATION_READ_ONLY_ACTION_POLICY,
    ...overrides,
  };
}

describe("buildPortfolioRotationHandoffPreview", () => {
  it("preserves complete authority metadata and exact prompt identity", () => {
    const inputAuthority = authority();
    const preview = buildPortfolioRotationHandoffPreview({
      authority: inputAuthority,
      rotationReason: "Processed-token telemetry reached the native threshold.",
      promptPreview: "Prepare a bounded rotation review.",
    });

    expect(preview.workerIdentity).toBe(inputAuthority.workerIdentity);
    expect(preview.roleAvailability).toBe(inputAuthority.roleAvailability);
    expect(preview.standardsAvailability.standards).toBe(inputAuthority.standards);
    expect(preview).toMatchObject({
      standardsAvailability: { available: true },
      promptPreviewIdentity: {
        workerIdentity: inputAuthority.workerIdentity,
        version: "rotation-prompt-v1",
      },
      promptPreview: "Prepare a bounded rotation review.",
      proposal: {
        version: PORTFOLIO_ROTATION_HANDOFF_PROPOSAL_VERSION,
        humanReviewRequired: true,
      },
      missingEvidence: [],
    });
    expect(preview.proposal.text).toContain(
      "environment env-1, project project-1, thread thread-1",
    );
    expect(preview.proposal.text).toContain(
      "Processed-token telemetry reached the native threshold.",
    );
  });

  it("reports unavailable metadata and evidence without inventing values", () => {
    const preview = buildPortfolioRotationHandoffPreview({
      authority: authority({
        workerIdentity: {
          key: "env-1:thread-1",
          environmentId: environmentId("env-1"),
          projectId: projectId("project-1"),
          threadId: threadId("thread-1"),
          worker: null,
        },
        roleAvailability: { role: null, available: false },
        standards: [],
      }),
      rotationReason: "   ",
      promptPreview: null,
    });

    expect(preview).toMatchObject({
      workerIdentity: { worker: null },
      roleAvailability: { role: null, available: false },
      standardsAvailability: { standards: [], available: false },
      promptPreview: null,
      missingEvidence: ["worker", "role", "standards", "rotationReason", "promptPreview"],
    });
    expect(preview.proposal.text).toContain("No handoff reason was supplied");
    expect(preview.proposal.text).not.toContain("Codex");
  });

  it("returns deterministic output for the same authority and evidence", () => {
    const input = {
      authority: authority(),
      rotationReason: "Native telemetry is in the watch range.",
      promptPreview: "Review the supplied role and standards.",
    };

    expect(buildPortfolioRotationHandoffPreview(input)).toEqual(
      buildPortfolioRotationHandoffPreview(input),
    );
  });

  it("bounds prompt and proposal text", () => {
    const preview = buildPortfolioRotationHandoffPreview({
      authority: authority(),
      rotationReason: "r".repeat(PORTFOLIO_ROTATION_HANDOFF_PROPOSAL_MAX_CHARACTERS * 2),
      promptPreview: "p".repeat(ROTATION_PROMPT_MAX_CHARACTERS * 2),
    });

    expect(preview.promptPreview).toHaveLength(ROTATION_PROMPT_MAX_CHARACTERS);
    expect(preview.promptPreview?.endsWith("…")).toBe(true);
    expect(preview.proposal.text).toHaveLength(PORTFOLIO_ROTATION_HANDOFF_PROPOSAL_MAX_CHARACTERS);
    expect(preview.proposal.text.endsWith("…")).toBe(true);
  });

  it("preserves the existing all-disabled action policy", () => {
    const inputAuthority = authority();
    const preview = buildPortfolioRotationHandoffPreview({
      authority: inputAuthority,
      rotationReason: "Review requested.",
      promptPreview: "Review only.",
    });

    expect(preview.actionPolicy).toBe(inputAuthority.actionPolicy);
    expect(preview.actionPolicy).toEqual({
      rotate: { enabled: false, reason: "read-only" },
      createSuccessor: { enabled: false, reason: "read-only" },
      rename: { enabled: false, reason: "read-only" },
      archive: { enabled: false, reason: "read-only" },
      handoff: { enabled: false, reason: "read-only" },
      cutover: { enabled: false, reason: "read-only" },
    });
  });
});
