import { describe, expect, it } from "@effect/vitest";
import { EnvironmentId, ThreadId, TurnId } from "@t3tools/contracts";
import { SpokenCompletionCueController } from "./spokenCompletionCue";
describe("SpokenCompletionCueController", () => {
  it("deduplicates exact identity and lets newer turns win", () => {
    const spoken: string[] = [];
    let stopped = 0;
    const controller = new SpokenCompletionCueController(
      (text) => spoken.push(text),
      () => {
        stopped += 1;
      },
    );
    const identity = {
      environmentId: EnvironmentId.make("env-1"),
      threadId: ThreadId.make("thread-1"),
      turnId: TurnId.make("turn-1"),
    };
    expect(controller.speakOnce(identity, "Thread completed")).toBe(true);
    expect(controller.speakOnce(identity, "Thread completed")).toBe(false);
    expect(
      controller.speakOnce(
        { ...identity, turnId: TurnId.make("turn-2") },
        "Newer thread completed",
      ),
    ).toBe(true);
    expect(spoken).toEqual(["Thread completed", "Newer thread completed"]);
    expect(stopped).toBe(2);
  });
});
