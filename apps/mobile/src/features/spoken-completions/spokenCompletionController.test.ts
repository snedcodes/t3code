// @ts-nocheck
import { describe, expect, it, vi } from "vitest";
import { SpokenCompletionController } from "./spokenCompletionController";
describe("spoken completions", () => {
  it("dedupes identity and flushes latest cue", () => {
    const speak = vi.fn(),
      stop = vi.fn(),
      c = new SpokenCompletionController({ speak, stop });
    const a = { environmentId: "e", threadId: "t", turnId: "1", threadLabel: "Build" };
    expect(c.completion(a)).toBe(true);
    expect(c.completion(a)).toBe(false);
    expect(c.completion({ ...a, turnId: "2" })).toBe(true);
    expect(stop).toHaveBeenCalledTimes(2);
    expect(speak).toHaveBeenLastCalledWith("Build is complete.");
  });
});
