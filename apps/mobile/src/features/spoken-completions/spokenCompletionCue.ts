export interface CompletionIdentity {
  readonly environmentId: string;
  readonly threadId: string;
  readonly turnId: string;
}
export const completionIdentityKey = (i: CompletionIdentity) =>
  `${i.environmentId}:${i.threadId}:${i.turnId}`;
export function buildCompletionCue(
  i: CompletionIdentity & {
    readonly threadLabel?: string | null;
    readonly outcome?: "completed" | "blocked" | "failed";
  },
): string {
  const label = i.threadLabel?.trim() || "T3 thread";
  return `${label} ${i.outcome === "blocked" ? "is blocked" : i.outcome === "failed" ? "failed" : "is complete"}.`;
}
