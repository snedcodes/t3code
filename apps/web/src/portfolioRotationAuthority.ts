import type { EnvironmentId, ProjectId, ThreadId } from "@t3tools/contracts";

import { type PortfolioRotationRow, type RotationStandardsLink } from "./portfolioRotation";

export type PortfolioRotationWorkerIdentity = {
  readonly key: PortfolioRotationRow["key"];
  readonly environmentId: EnvironmentId;
  readonly projectId: ProjectId;
  readonly threadId: ThreadId;
  readonly worker: PortfolioRotationRow["worker"];
};

export type PortfolioRotationRoleAvailability = {
  readonly role: PortfolioRotationRow["role"];
  readonly available: boolean;
};

export type PortfolioRotationAction =
  | "rotate"
  | "createSuccessor"
  | "rename"
  | "archive"
  | "handoff"
  | "cutover";

export type PortfolioRotationActionPolicy = Readonly<
  Record<PortfolioRotationAction, { readonly enabled: false; readonly reason: "read-only" }>
>;

export const PORTFOLIO_ROTATION_READ_ONLY_ACTION_POLICY = {
  rotate: { enabled: false, reason: "read-only" },
  createSuccessor: { enabled: false, reason: "read-only" },
  rename: { enabled: false, reason: "read-only" },
  archive: { enabled: false, reason: "read-only" },
  handoff: { enabled: false, reason: "read-only" },
  cutover: { enabled: false, reason: "read-only" },
} as const satisfies PortfolioRotationActionPolicy;

export type PortfolioRotationAuthority = {
  readonly workerIdentity: PortfolioRotationWorkerIdentity;
  readonly roleAvailability: PortfolioRotationRoleAvailability;
  readonly standards: ReadonlyArray<RotationStandardsLink>;
  readonly promptPreviewVersion: PortfolioRotationRow["promptPreviewVersion"];
  readonly actionPolicy: PortfolioRotationActionPolicy;
};

export function resolvePortfolioRotationAuthority(
  row: PortfolioRotationRow,
): PortfolioRotationAuthority {
  return {
    workerIdentity: {
      key: row.key,
      environmentId: row.environmentId,
      projectId: row.projectId,
      threadId: row.threadId,
      worker: row.worker,
    },
    roleAvailability: {
      role: row.role,
      available: row.role !== null,
    },
    standards: row.standards,
    promptPreviewVersion: row.promptPreviewVersion,
    actionPolicy: PORTFOLIO_ROTATION_READ_ONLY_ACTION_POLICY,
  };
}
