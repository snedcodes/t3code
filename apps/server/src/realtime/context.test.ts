import { describe, expect, it } from "vite-plus/test";
import { MessageId, ProjectId, ThreadId, TurnId } from "@t3tools/contracts";
import { buildRealtimeThreadContext, RealtimeContextSelectionError } from "./context.ts";

const thread = {
  id: ThreadId.make("thread"),
  projectId: ProjectId.make("project"),
  title: "Phone voice",
  updatedAt: "2026-10-01T01:00:00.000Z",
  latestTurn: {
    turnId: TurnId.make("turn"),
    state: "completed" as const,
    requestedAt: "2026-10-01T00:00:00.000Z",
    startedAt: null,
    completedAt: "2026-10-01T01:00:00.000Z",
    assistantMessageId: null,
  },
  messages: Array.from({ length: 24 }, (_, i) => ({
    id: MessageId.make(`message-${i}`),
    role: i % 2 ? ("assistant" as const) : ("user" as const),
    text: `Actual text ${i}`,
    turnId: TurnId.make("turn"),
    streaming: false,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
  })),
};
describe("realtime canonical thread context", () => {
  it("resumes saved voice history separately from the source coding thread", () => {
    const result = buildRealtimeThreadContext({
      thread,
      projectTitle: "T3",
      conversation: {
        conversationThreadId: ThreadId.make("voice-assistant:thread"),
        messages: [
          {
            id: "voice-message",
            role: "user",
            text: "Remember our voice discussion",
            createdAt: thread.updatedAt,
          },
        ],
        nextOffset: null,
      },
    });
    expect(result.provenance.conversationThreadId).toBe("voice-assistant:thread");
    expect(result.provenance.conversationMessageCount).toBe(1);
    expect(result.provenance.messageIds).not.toContain("voice-message");
    expect(result.instructions).toContain("Remember our voice discussion");
    expect(result.instructions).toContain("previousVoiceMessages");
  });
  it("includes actual recent conversation, exact identity, and honest omitted-source warnings", () => {
    const result = buildRealtimeThreadContext({ thread, projectTitle: "T3" });
    expect(result.provenance.messageCount).toBe(20);
    expect(result.provenance).toMatchObject({
      projectId: "project",
      threadId: "thread",
      latestTurnId: "turn",
      truncated: true,
    });
    expect(result.instructions).toContain("Actual text 23");
    expect(result.instructions).not.toContain("Actual text 0");
    expect(result.warnings.join(" ")).toContain("documents");
  });
  it("retains an exact selected message outside the recent window without duplicating it", () => {
    const result = buildRealtimeThreadContext({
      thread,
      projectTitle: "T3",
      selectedMessageId: "message-0",
    });
    expect(result.provenance.messageCount).toBe(21);
    expect(result.provenance.messageIds.filter((id) => id === "message-0")).toHaveLength(1);
    expect(result.instructions).toContain("Actual text 0");
    expect(() =>
      buildRealtimeThreadContext({
        thread,
        projectTitle: "T3",
        selectedMessageId: "other-thread-message",
      }),
    ).toThrow(RealtimeContextSelectionError);
  });
  it("includes selected document text and provenance without spending the history budget", () => {
    const result = buildRealtimeThreadContext({
      thread,
      projectTitle: "T3",
      documents: [
        {
          path: "docs/plan.md",
          title: "Plan",
          text: "Actual selected document",
          bytesIncluded: 24,
          truncated: true,
        },
      ],
      documentWarnings: ["Document clipped: docs/plan.md."],
      documentsTruncated: true,
    });
    expect(result.provenance.messageCount).toBe(20);
    expect(result.provenance.documents).toEqual([
      { path: "docs/plan.md", title: "Plan", bytesIncluded: 24, truncated: true },
    ]);
    expect(result.provenance.documentsTruncated).toBe(true);
    expect(result.instructions).toContain("Actual selected document");
    expect(result.instructions).toContain("Actual text 23");
    expect(result.warnings).toContain("Document clipped: docs/plan.md.");
    expect(result.warnings.join(" ")).toContain("Tasks have not been loaded");
  });
  it("excludes system/streaming history, includes explicitly selected streaming text with warning, and bounds content", () => {
    const messages = thread.messages.map((message, i) => ({
      ...message,
      text: "a".repeat(20_000),
      role: i === 0 ? ("system" as const) : message.role,
      streaming: i === 23,
    }));
    const result = buildRealtimeThreadContext({
      thread: { ...thread, messages },
      projectTitle: "T3",
      selectedMessageId: "message-23",
    });
    expect(result.provenance.messageIds).not.toContain("message-0");
    expect(result.provenance.messageIds).toContain("message-23");
    expect(result.warnings.join(" ")).toContain("streaming");
    expect(result.instructions.length).toBeLessThan(50_000);
  });
});
