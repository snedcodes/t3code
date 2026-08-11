import type { ProviderApprovalDecision } from "@t3tools/contracts";

export const PENDING_APPROVAL_ACTIONS = [
  { key: "proceed", label: "Proceed", decision: "accept" },
  { key: "session", label: "1 · Session", decision: "acceptForSession" },
  { key: "decline", label: "2 · Decline", decision: "decline" },
  { key: "cancel", label: "3 · Cancel request", decision: "cancel" },
] as const satisfies ReadonlyArray<{
  readonly key: string;
  readonly label: string;
  readonly decision: ProviderApprovalDecision;
}>;
