import type { EnvironmentId, ThreadId, TurnId } from "@t3tools/contracts";
export type CompletionIdentity = Readonly<{
  environmentId: EnvironmentId;
  threadId: ThreadId;
  turnId: TurnId;
}>;
export class SpokenCompletionCueController {
  private lastKey: string | null = null;
  constructor(
    private readonly speak: (text: string) => void,
    private readonly stop: () => void = () => undefined,
  ) {}
  speakOnce(identity: CompletionIdentity, text: string): boolean {
    const key = `${identity.environmentId}:${identity.threadId}:${identity.turnId}`;
    if (key === this.lastKey) return false;
    this.lastKey = key;
    this.stop();
    this.speak(text);
    return true;
  }
  reset(): void {
    this.lastKey = null;
    this.stop();
  }
}
