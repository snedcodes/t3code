export const CONTEXT_ROTATION_WATCH_TOKENS = 150_000_000;
export const CONTEXT_ROTATION_REQUIRED_TOKENS = 200_000_000;

export type ContextRotationHealth = "unavailable" | "normal" | "watch" | "rotation-required";

export function classifyContextRotationHealth(
  totalProcessedTokens: number | null | undefined,
): ContextRotationHealth {
  if (totalProcessedTokens === null || totalProcessedTokens === undefined) {
    return "unavailable";
  }
  if (totalProcessedTokens >= CONTEXT_ROTATION_REQUIRED_TOKENS) {
    return "rotation-required";
  }
  if (totalProcessedTokens >= CONTEXT_ROTATION_WATCH_TOKENS) {
    return "watch";
  }
  return "normal";
}
