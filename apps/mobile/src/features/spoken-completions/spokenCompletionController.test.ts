import { describe, expect, it, vi } from "vitest";
import { SpokenCompletionController } from "./spokenCompletionController";

describe("SpokenCompletionController", () => {
  it("speaks one cue per native completion identity and flushes before newer work", () => {
    const speak = vi.fn();
    const stop = vi.fn();
    const controller = new SpokenCompletionController({ speak, stop });
    const completion = { environmentId: "env", threadId: "thread", turnId: "turn-1", threadLabel: "Build" };
    expect(controller.completion(completion)).toBe(true);
    expect(controller.completion(completion)).toBe(false);
    expect(controller.completion({ ...completion, turnId: "turn-2" })).toBe(true);
    expect(stop).toHaveBeenCalledTimes(2);
    expect(speak).toHaveBeenNthCalledWith(1, "Build is complete.");
    expect(speak).toHaveBeenNthCalledWith(2, "Build is complete.");
  });
});
