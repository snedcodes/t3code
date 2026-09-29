import { describe, expect, it } from "vite-plus/test";
import {
  classifyContextRotationHealth,
  CONTEXT_ROTATION_REQUIRED_TOKENS,
  CONTEXT_ROTATION_WATCH_TOKENS,
} from "./portfolioContextHealth";

describe("classifyContextRotationHealth", () => {
  it("reports unavailable when native telemetry has not arrived", () => {
    expect(classifyContextRotationHealth(null)).toBe("unavailable");
    expect(classifyContextRotationHealth(undefined)).toBe("unavailable");
  });

  it("uses the documented watch and rotation thresholds", () => {
    expect(classifyContextRotationHealth(CONTEXT_ROTATION_WATCH_TOKENS - 1)).toBe("normal");
    expect(classifyContextRotationHealth(CONTEXT_ROTATION_WATCH_TOKENS)).toBe("watch");
    expect(classifyContextRotationHealth(CONTEXT_ROTATION_REQUIRED_TOKENS)).toBe(
      "rotation-required",
    );
  });
});
