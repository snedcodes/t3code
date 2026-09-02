import { buildCompletionCue, completionIdentityKey, type CompletionIdentity } from "./spokenCompletionCue";

export interface SpokenCompletionControllerOptions {
  readonly speak: (text: string) => void;
  readonly stop: () => void;
}

export class SpokenCompletionController {
  private readonly spoken = new Set<string>();
  private latestKey: string | null = null;

  constructor(private readonly options: SpokenCompletionControllerOptions) {}

  completion(input: CompletionIdentity & { readonly threadLabel?: string | null; readonly environmentLabel?: string | null; readonly outcome?: "completed" | "blocked" | "failed" }): boolean {
    const key = completionIdentityKey(input);
    if (this.spoken.has(key)) return false;
    this.spoken.add(key);
    this.latestKey = key;
    this.options.stop();
    this.options.speak(buildCompletionCue(input));
    return true;
  }
}
