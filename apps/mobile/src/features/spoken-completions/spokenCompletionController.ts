import {
  buildCompletionCue,
  completionIdentityKey,
  type CompletionIdentity,
} from "./spokenCompletionCue";
export class SpokenCompletionController {
  private readonly spoken = new Set<string>();
  constructor(private readonly audio: { speak(text: string): void; stop(): void }) {}
  completion(
    input: CompletionIdentity & {
      readonly threadLabel?: string | null;
      readonly outcome?: "completed" | "blocked" | "failed";
    },
  ): boolean {
    const key = completionIdentityKey(input);
    if (this.spoken.has(key)) return false;
    this.spoken.add(key);
    this.audio.stop();
    this.audio.speak(buildCompletionCue(input));
    return true;
  }
}
