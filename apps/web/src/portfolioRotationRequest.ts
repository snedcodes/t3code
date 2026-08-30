import type { PortfolioRotationRow } from "./portfolioRotation";
import { resolvePortfolioRotationAuthority } from "./portfolioRotationAuthority";

export const PORTFOLIO_ROTATION_REQUEST_VERSION = "rotation-request-v1";
export const PORTFOLIO_ROTATION_REQUEST_MAX_CHARACTERS = 1_200;

export type ReviewedPortfolioRotationRequest = {
  readonly version: typeof PORTFOLIO_ROTATION_REQUEST_VERSION;
  readonly action: "rotate";
  readonly reviewed: true;
  readonly target: {
    readonly environmentId: PortfolioRotationRow["environmentId"];
    readonly projectId: PortfolioRotationRow["projectId"];
    readonly threadId: PortfolioRotationRow["threadId"];
  };
  readonly worker: PortfolioRotationRow["worker"];
  readonly role: PortfolioRotationRow["role"];
  readonly standards: PortfolioRotationRow["standards"];
  readonly promptPreviewVersion: PortfolioRotationRow["promptPreviewVersion"];
  readonly prompt: string;
};

export type PortfolioRotationRequestResult =
  | { readonly ok: false; readonly reason: "explicit-review-required" }
  | { readonly ok: true; readonly request: ReviewedPortfolioRotationRequest };

function boundedPrompt(value: string): string {
  return value.length <= PORTFOLIO_ROTATION_REQUEST_MAX_CHARACTERS
    ? value
    : `${value.slice(0, PORTFOLIO_ROTATION_REQUEST_MAX_CHARACTERS - 1)}…`;
}

export function buildReviewedPortfolioRotationRequest(input: {
  readonly row: PortfolioRotationRow;
  readonly reviewed: boolean;
}): PortfolioRotationRequestResult {
  if (!input.reviewed) return { ok: false, reason: "explicit-review-required" };

  const authority = resolvePortfolioRotationAuthority(input.row);
  const target = authority.workerIdentity;
  const standards =
    authority.standards.length > 0
      ? authority.standards
          .map(
            (standard) => `${standard.label}: ${standard.path}@${standard.revision ?? "unknown"}`,
          )
          .join("; ")
      : "unavailable";
  const prompt = boundedPrompt(
    [
      `Reviewed Rotate request (${PORTFOLIO_ROTATION_REQUEST_VERSION}).`,
      `Exact target: environment ${target.environmentId}, project ${target.projectId}, thread ${target.threadId}.`,
      `Worker: ${target.worker ?? "unavailable"}. Role: ${authority.roleAvailability.role ?? "unavailable"}.`,
      `Rotation reason: ${input.row.rotationReason}`,
      `Standards: ${standards}`,
      "Review this exact native target and return one bounded rotation decision with a native receipt.",
      "Do not create a successor, rename, archive, handoff, cut over, schedule, or dispatch a follow-up turn.",
      "If the target, role, standards, or receipt evidence is insufficient, report blocked without changing lifecycle state.",
    ].join("\n"),
  );

  return {
    ok: true,
    request: {
      version: PORTFOLIO_ROTATION_REQUEST_VERSION,
      action: "rotate",
      reviewed: true,
      target: {
        environmentId: target.environmentId,
        projectId: target.projectId,
        threadId: target.threadId,
      },
      worker: target.worker,
      role: authority.roleAvailability.role,
      standards: authority.standards,
      promptPreviewVersion: authority.promptPreviewVersion,
      prompt,
    },
  };
}
