import type { RealtimeMessageTools } from "./realtimeAssistantTransport";

export interface VoiceMessageDraft {
  draftId: string;
  text: string;
  status: "draft" | "sending" | "queued";
  messageId: string;
  commandId: string;
  createdAt: string;
}

/** Sheet-local drafts; only explicitly sent messages enter the durable thread outbox. */
export class RealtimeMessageDraft implements RealtimeMessageTools {
  private current: VoiceMessageDraft | null = null;
  private pending: Promise<unknown> | null = null;
  private error: string | null = null;
  private listeners = new Set<() => void>();
  constructor(
    private readonly options: {
      target: { environmentId: string; projectId: string; threadId: string };
      identity(): { draftId: string; messageId: string; commandId: string; createdAt: string };
      enqueue(draft: VoiceMessageDraft): Promise<void>;
    },
  ) {}

  snapshot = () => ({ draft: this.current, error: this.error });
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private changed() {
    this.listeners.forEach((listener) => listener());
  }
  private result() {
    return this.current
      ? { ...this.options.target, ...this.current }
      : { ...this.options.target, status: "empty" };
  }
  async draft(input: { text: string }): Promise<unknown> {
    if (this.pending)
      return { error: "send_pending", message: "Wait for the current draft send to finish." };
    if (!input.text.trim() || input.text.length > 60000)
      return { error: "invalid_text", message: "Draft text must contain 1 to 60000 characters." };
    this.current = { ...this.options.identity(), text: input.text, status: "draft" };
    this.error = null;
    this.changed();
    return this.result();
  }
  edit(text: string) {
    if (this.pending || text.length > 60000) return;
    this.current = { ...this.options.identity(), text, status: "draft" };
    this.error = null;
    this.changed();
  }
  async get(): Promise<unknown> {
    return this.result();
  }
  discard() {
    if (this.pending) return;
    this.current = null;
    this.error = null;
    this.changed();
  }
  async send(input: { draftId: string }): Promise<unknown> {
    const draft = this.current;
    if (!draft || input.draftId !== draft.draftId)
      return { error: "stale_draft", message: "Read the current draft before sending." };
    if (!draft.text.trim())
      return { error: "invalid_text", message: "Draft text cannot be empty." };
    if (draft.status === "queued") return this.result();
    if (this.pending) return this.pending;
    draft.status = "sending";
    this.error = null;
    this.changed();
    this.pending = Promise.resolve()
      .then(() => this.options.enqueue(draft))
      .then(
        () => {
          draft.status = "queued";
          return this.result();
        },
        () => {
          draft.status = "draft";
          this.error = "Could not save the message to the outbox. Retry Send with this same draft.";
          return { error: "queue_failed", message: this.error, draftId: draft.draftId };
        },
      )
      .finally(() => {
        this.pending = null;
        this.changed();
      });
    return this.pending;
  }
}
