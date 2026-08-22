import { ROTATION_PROMPT_MAX_CHARACTERS } from "./portfolioRotation";
import type {
  PortfolioRotationActionPolicy,
  PortfolioRotationAuthority,
  PortfolioRotationRoleAvailability,
  PortfolioRotationWorkerIdentity,
} from "./portfolioRotationAuthority";

export const PORTFOLIO_ROTATION_HANDOFF_PROPOSAL_VERSION = "rotation-handoff-proposal-v1";
export const PORTFOLIO_ROTATION_HANDOFF_PROPOSAL_MAX_CHARACTERS = 1_200;

export type PortfolioRotationHandoffMissingEvidence =
  | "worker"
  | "role"
  | "standards"
  | "rotationReason"
  | "promptPreview";

export type PortfolioRotationStandardsAvailability = {
  readonly standards: PortfolioRotationAuthority["standards"];
  readonly available: boolean;
};

export type PortfolioRotationPromptPreviewIdentity = {
  readonly workerIdentity: PortfolioRotationWorkerIdentity;
  readonly version: PortfolioRotationAuthority["promptPreviewVersion"];
};

export type PortfolioRotationHandoffPreview = {
  readonly workerIdentity: PortfolioRotationWorkerIdentity;
  readonly roleAvailability: PortfolioRotationRoleAvailability;
  readonly standardsAvailability: PortfolioRotationStandardsAvailability;
  readonly promptPreviewIdentity: PortfolioRotationPromptPreviewIdentity;
  readonly promptPreview: string | null;
  readonly proposal: {
    readonly version: typeof PORTFOLIO_ROTATION_HANDOFF_PROPOSAL_VERSION;
    readonly text: string;
    readonly humanReviewRequired: true;
  };
  readonly missingEvidence: ReadonlyArray<PortfolioRotationHandoffMissingEvidence>;
  readonly actionPolicy: PortfolioRotationActionPolicy;
};

function evidenceText(value: string | null): string | null {
  return value !== null && value.trim().length > 0 ? value : null;
}

function boundedText(value: string, maxCharacters: number): string {
  return value.length <= maxCharacters ? value : `${value.slice(0, maxCharacters - 1)}…`;
}

function missingEvidence(input: {
  readonly authority: PortfolioRotationAuthority;
  readonly rotationReason: string | null;
  readonly promptPreview: string | null;
}): ReadonlyArray<PortfolioRotationHandoffMissingEvidence> {
  const missing: PortfolioRotationHandoffMissingEvidence[] = [];
  if (input.authority.workerIdentity.worker === null) missing.push("worker");
  if (!input.authority.roleAvailability.available) missing.push("role");
  if (input.authority.standards.length === 0) missing.push("standards");
  if (input.rotationReason === null) missing.push("rotationReason");
  if (input.promptPreview === null) missing.push("promptPreview");
  return missing;
}

function proposalText(input: {
  readonly authority: PortfolioRotationAuthority;
  readonly rotationReason: string | null;
  readonly missingEvidence: ReadonlyArray<PortfolioRotationHandoffMissingEvidence>;
}): string {
  const identity = input.authority.workerIdentity;
  const reason = input.rotationReason
    ? `A handoff may be considered because: ${input.rotationReason}`
    : "No handoff reason was supplied; human review must obtain it before considering a handoff.";
  const missing =
    input.missingEvidence.length === 0
      ? "All bounded review evidence is available."
      : `Missing review evidence: ${input.missingEvidence.join(", ")}.`;

  return boundedText(
    [
      `Review a possible handoff for environment ${identity.environmentId}, project ${identity.projectId}, thread ${identity.threadId}.`,
      reason,
      missing,
      "This is a read-only proposal for human review; rotate, successor creation, rename, archive, handoff, and cutover remain disabled.",
    ].join("\n"),
    PORTFOLIO_ROTATION_HANDOFF_PROPOSAL_MAX_CHARACTERS,
  );
}

/** Builds a bounded review projection without dispatching or changing rotation authority. */
export function buildPortfolioRotationHandoffPreview(input: {
  readonly authority: PortfolioRotationAuthority;
  readonly rotationReason: string | null;
  readonly promptPreview: string | null;
}): PortfolioRotationHandoffPreview {
  const rotationReason = evidenceText(input.rotationReason);
  const suppliedPromptPreview = evidenceText(input.promptPreview);
  const promptPreview = suppliedPromptPreview
    ? boundedText(suppliedPromptPreview, ROTATION_PROMPT_MAX_CHARACTERS)
    : null;
  const missing = missingEvidence({
    authority: input.authority,
    rotationReason,
    promptPreview: suppliedPromptPreview,
  });

  return {
    workerIdentity: input.authority.workerIdentity,
    roleAvailability: input.authority.roleAvailability,
    standardsAvailability: {
      standards: input.authority.standards,
      available: input.authority.standards.length > 0,
    },
    promptPreviewIdentity: {
      workerIdentity: input.authority.workerIdentity,
      version: input.authority.promptPreviewVersion,
    },
    promptPreview,
    proposal: {
      version: PORTFOLIO_ROTATION_HANDOFF_PROPOSAL_VERSION,
      text: proposalText({
        authority: input.authority,
        rotationReason,
        missingEvidence: missing,
      }),
      humanReviewRequired: true,
    },
    missingEvidence: missing,
    actionPolicy: input.authority.actionPolicy,
  };
}
