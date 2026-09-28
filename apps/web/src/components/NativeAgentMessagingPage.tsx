import { useMemo, useState } from "react";
import { MessageSquareTextIcon } from "lucide-react";
import { CommandId } from "@t3tools/contracts";
import { squashAtomCommandFailure } from "@t3tools/client-runtime/state/runtime";

import { useEnvironments } from "../state/environments";
import { useProjects, useThread, useThreadShells } from "../state/entities";
import { threadEnvironment } from "../state/threads";
import { useAtomCommand } from "../state/use-atom-command";
import { newMessageId, randomUUID } from "../lib/utils";
import { buildNativeMessageTargets } from "../nativeMessageTargets";

type SentMessage = {
  readonly targetKey: string;
  readonly commandId: string;
  readonly messageId: string;
};

function nativeDispatchFailureDetail(result: Parameters<typeof squashAtomCommandFailure>[0]) {
  const failure = squashAtomCommandFailure(result);
  if (typeof failure === "object" && failure !== null) {
    const tag = "_tag" in failure && typeof failure._tag === "string" ? failure._tag : null;
    const message =
      "message" in failure && typeof failure.message === "string" ? failure.message : null;
    if (tag && message) return `Native turn rejected (${tag}): ${message}`;
    if (tag) return `Native turn rejected (${tag}).`;
    if (message) return `Native turn rejected: ${message}`;
  }
  return "Native turn rejected by the target environment.";
}

export function NativeAgentMessagingPage() {
  const { environments } = useEnvironments();
  const projects = useProjects();
  const threads = useThreadShells();
  const targets = useMemo(() => buildNativeMessageTargets(projects, threads), [projects, threads]);
  const environmentById = useMemo(
    () => new Map(environments.map((environment) => [String(environment.environmentId), environment])),
    [environments],
  );
  const [selectedKey, setSelectedKey] = useState("");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);
  const [lastSent, setLastSent] = useState<SentMessage | null>(null);
  const selectedTarget = targets.find((target) => target.key === selectedKey) ?? null;
  const selectedThread = useThread(
    selectedTarget
      ? { environmentId: selectedTarget.environmentId, threadId: selectedTarget.threadId }
      : null,
  );
  const startThreadTurn = useAtomCommand(threadEnvironment.startTurn, { reportFailure: false });
  const canSend =
    selectedTarget !== null &&
    selectedThread !== null &&
    selectedThread.id === selectedTarget.threadId &&
    selectedThread.environmentId === selectedTarget.environmentId &&
    selectedThread.projectId === selectedTarget.projectId;
  const messageReadback =
    lastSent !== null && selectedTarget !== null && lastSent.targetKey === selectedTarget.key
      ? (selectedThread?.messages.find((entry) => entry.id === lastSent.messageId) ?? null)
      : null;

  const sendMessage = async () => {
    const text = message.trim();
    if (!canSend || !selectedTarget || !selectedThread || !text || isSending) return;

    setIsSending(true);
    setDetail(null);
    const commandId = CommandId.make(randomUUID());
    const messageId = newMessageId();
    try {
      const result = await startThreadTurn({
        environmentId: selectedTarget.environmentId,
        input: {
          commandId,
          threadId: selectedTarget.threadId,
          message: { messageId, role: "user", text, attachments: [] },
          modelSelection: selectedThread.modelSelection,
          runtimeMode: selectedThread.runtimeMode,
          interactionMode: selectedThread.interactionMode,
          createdAt: new Date().toISOString(),
        },
      });
      if (result._tag === "Success") {
        setMessage("");
        setLastSent({ targetKey: selectedTarget.key, commandId, messageId });
        setDetail(`Native turn accepted (sequence ${result.value.sequence}, command ${commandId}).`);
      } else {
        setDetail(nativeDispatchFailureDetail(result));
      }
    } finally {
      setIsSending(false);
    }
  };

  return (
    <main className="mx-auto flex h-full w-full max-w-4xl flex-col gap-5 overflow-y-auto p-6">
      <header className="flex items-center gap-3">
        <MessageSquareTextIcon className="size-5 text-violet-400" aria-hidden="true" />
        <div>
          <h1 className="text-xl font-semibold">Native T3 messages</h1>
          <p className="text-sm text-muted-foreground">
            Discover a connected environment, project, and thread, then send through its native T3 turn channel.
          </p>
        </div>
      </header>

      {targets.length === 0 ? (
        <p className="rounded-xl border border-border p-5 text-sm text-muted-foreground" role="status">
          No active native threads with a resolved project are available. Connect an environment and wait for its thread list.
        </p>
      ) : (
        <section className="space-y-4 rounded-xl border border-border/70 bg-card/30 p-5" aria-label="Send a native message">
          <label className="grid gap-2 text-sm font-medium">
            Exact target
            <select
              className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              aria-label="Target environment, project, and thread"
              value={selectedKey}
              onChange={(event) => {
                setSelectedKey(event.currentTarget.value);
                setLastSent(null);
                setDetail(null);
              }}
            >
              <option value="">Select an environment / project / thread</option>
              {targets.map((target) => {
                const environment = environmentById.get(String(target.environmentId));
                return (
                  <option key={target.key} value={target.key}>
                    {environment?.label ?? target.environmentId} / {target.projectTitle} / {target.threadTitle}
                  </option>
                );
              })}
            </select>
          </label>

          {selectedTarget ? (
            <p className="text-xs text-muted-foreground" aria-label="Selected exact target">
              Target IDs: {selectedTarget.environmentId} / {selectedTarget.projectId} / {selectedTarget.threadId}
            </p>
          ) : null}
          <label className="grid gap-2 text-sm font-medium">
            Message
            <textarea
              className="min-h-28 rounded-md border border-border bg-background p-3 text-sm font-normal"
              aria-label="Native message text"
              placeholder="Send one ordinary native T3 turn"
              value={message}
              onChange={(event) => setMessage(event.currentTarget.value)}
              disabled={isSending}
            />
          </label>
          <button
            type="button"
            className="rounded-md bg-violet-500 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canSend || !message.trim() || isSending}
            onClick={() => void sendMessage()}
          >
            {isSending ? "Sending…" : "Send native message"}
          </button>
          {detail ? (
            <p className="text-sm" role="status">
              {detail}
              {messageReadback ? ` Read back in target thread: ${messageReadback.id}.` : " Waiting for target-thread readback."}
            </p>
          ) : null}
        </section>
      )}
    </main>
  );
}
