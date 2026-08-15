import { describe, expect, it } from "vitest";

import { createPausedNativeHeartbeat, validateNativeHeartbeat } from "./portfolioHeartbeat";

describe("portfolioHeartbeat", () => {
  it("creates a paused, one-turn native T3 definition without session identity", () => {
    const definition = createPausedNativeHeartbeat();

    expect(definition.status).toBe("paused");
    expect(definition.targetThread).toBeNull();
    expect(definition.maxRuns).toBe(1);
    expect(definition.allowedActions).toEqual(["send-normal-t3-turn"]);
    expect(definition.receiptOwner).toBe("native-t3-orchestration");
    expect("sessionKey" in definition).toBe(false);
  });

  it("accepts the bounded default and rejects unsafe changes", () => {
    const definition = createPausedNativeHeartbeat();
    expect(validateNativeHeartbeat(definition).valid).toBe(true);

    const invalid = validateNativeHeartbeat({
      ...definition,
      cadenceMinutes: 0,
      maxRuns: 0,
      finishLine: "",
      allowedActions: ["dispatch-heartbeat"] as never,
      stopConditions: [],
      receiptOwner: "voicetools" as never,
    });
    expect(invalid.valid).toBe(false);
    expect(invalid.errors).toHaveLength(6);
  });
});
