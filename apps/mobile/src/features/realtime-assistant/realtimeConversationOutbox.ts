import type { RealtimeTranscriptItem } from "./realtimeAssistantController";

export interface ConversationSaveInput {
  projectId: string;
  threadId: string;
  conversationThreadId: string;
  sessionId: string;
  items: RealtimeTranscriptItem[];
}

/** Only unacknowledged utterances live here. The server owns conversation history. */
export class RealtimeConversationOutbox {
  private readonly pending = new Map<string, { sessionId: string; item: RealtimeTranscriptItem }>();
  private readonly listeners = new Set<() => void>();
  private task: Promise<void> | null = null;
  private retryRequested = false;
  private error: string | null = null;

  constructor(
    readonly target: Pick<ConversationSaveInput, "projectId" | "threadId" | "conversationThreadId">,
    private readonly save: (
      input: ConversationSaveInput,
    ) => Promise<{ conversationThreadId: string; saved: number }>,
  ) {}

  snapshot() {
    return { pending: this.pending.size, saving: this.task !== null, error: this.error };
  }
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  enqueue(item: RealtimeTranscriptItem, sessionId: string) {
    if (!item.text.trim()) return;
    for (let offset = 0; offset < item.text.length; offset += 60000) {
      const id = item.text.length <= 60000 ? item.id : `${item.id}:part:${offset / 60000}`;
      const key = JSON.stringify([sessionId, id]);
      if (!this.pending.has(key))
        this.pending.set(key, {
          sessionId,
          item: { ...item, id, text: item.text.slice(offset, offset + 60000) },
        });
    }
    this.notify();
    if (!this.error) void this.flush();
  }
  retry() {
    this.error = null;
    if (this.task) this.retryRequested = true;
    this.notify();
    // A retry requested during an in-flight failure also waits for its follow-up send.
    return this.flush().then(() => this.task ?? Promise.resolve());
  }
  flush(): Promise<void> {
    if (this.task) return this.task;
    if (!this.pending.size) return Promise.resolve();
    const task = Promise.resolve()
      .then(async () => {
        while (this.pending.size) {
          const first = this.pending.values().next().value!;
          const batch = [...this.pending]
            .filter(([, value]) => value.sessionId === first.sessionId)
            .slice(0, 16);
          try {
            const result = await this.save({
              ...this.target,
              sessionId: first.sessionId,
              items: batch.map(([, value]) => value.item),
            });
            if (result.conversationThreadId !== this.target.conversationThreadId) throw new Error();
            for (const [key] of batch) this.pending.delete(key);
            this.error = null;
            this.notify();
          } catch {
            this.error =
              "Voice messages could not be saved. Unsaved messages are retained for retry.";
            break;
          }
        }
      })
      .finally(() => {
        this.task = null;
        this.notify();
        if (this.retryRequested) {
          this.retryRequested = false;
          void this.retry();
        }
      });
    this.task = task;
    this.notify();
    return task;
  }
  private notify() {
    this.listeners.forEach((listener) => listener());
  }
}
