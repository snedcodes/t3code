import { createEnvironmentRealtimeConversationCommands } from "@t3tools/client-runtime/state/realtimeConversationHttp";
import {
  RealtimeConversationOpenRequest,
  RealtimeConversationMessagesRequest,
  type EnvironmentId,
  type RealtimeConversationOpenResponse,
} from "@t3tools/contracts";
import * as Schema from "effect/Schema";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import { connectionAtomRuntime } from "../../connection/runtime";
import { useAtomCommand } from "../../state/use-atom-command";
import { RealtimeConversationOutbox } from "./realtimeConversationOutbox";
import type { RealtimeTranscriptItem } from "./realtimeAssistantController";

const commands = createEnvironmentRealtimeConversationCommands(connectionAtomRuntime);
const decodeOpen = Schema.decodeUnknownSync(RealtimeConversationOpenRequest);
const decodeMessages = Schema.decodeUnknownSync(RealtimeConversationMessagesRequest);
// Delivery outbox survives modal unmount. Acknowledged history is never cached here.
const outboxes = new Map<string, RealtimeConversationOutbox>();

export function useRealtimeConversation(
  environmentId: EnvironmentId,
  projectId: string,
  threadId: string,
) {
  const open = useAtomCommand(commands.open, { reportFailure: false, reportDefect: false });
  const save = useAtomCommand(commands.save, { reportFailure: false, reportDefect: false });
  const key = JSON.stringify([environmentId, projectId, threadId]);
  const [history, setHistory] = useState<RealtimeConversationOpenResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [delivery, setDelivery] = useState({
    pending: 0,
    saving: false,
    error: null as string | null,
  });
  const outbox = useRef<RealtimeConversationOutbox | null>(null);
  const generation = useRef(0);
  const load = useCallback(async () => {
    const ticket = ++generation.current;
    try {
      const pending = outboxes.get(key);
      if (pending?.snapshot().pending) await pending.retry();
      const result = await open({ environmentId, input: decodeOpen({ projectId, threadId }) });
      if (result._tag === "Failure") throw new Error();
      if (ticket !== generation.current) return false;
      const existing = outboxes.get(key);
      if (existing && existing.target.conversationThreadId !== result.value.conversationThreadId)
        throw new Error();
      const queue =
        existing ??
        new RealtimeConversationOutbox(
          { projectId, threadId, conversationThreadId: result.value.conversationThreadId },
          async (input) => {
            const saved = await save({ environmentId, input: decodeMessages(input) });
            if (saved._tag === "Failure") throw new Error();
            return saved.value;
          },
        );
      outboxes.set(key, queue);
      outbox.current = queue;
      setHistory(result.value);
      setError(null);
      setDelivery(queue.snapshot());
      return true;
    } catch {
      if (ticket === generation.current)
        setError(
          "Could not load this assistant's saved conversation. Retry before starting voice.",
        );
      return false;
    }
  }, [environmentId, key, open, projectId, save, threadId]);
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- Load synchronizes canonical HTTP history; state updates follow the awaited response.
    void load();
    const active = AppState.addEventListener("change", (next) => {
      if (next === "active") void outbox.current?.retry();
    });
    return () => {
      generation.current += 1;
      active.remove();
      void outbox.current?.retry();
    };
  }, [load]);
  useEffect(() => {
    if (!history || !outbox.current) return;
    const queue = outbox.current;
    const ticket = generation.current;
    const changed = () => {
      if (ticket === generation.current) setDelivery(queue.snapshot());
    };
    return queue.subscribe(changed);
  }, [history]);
  const completed = useCallback((item: RealtimeTranscriptItem, sessionId: string) => {
    outbox.current?.enqueue(item, sessionId);
  }, []);
  return {
    history,
    ready: history !== null && error === null,
    error,
    delivery,
    load,
    completed,
    retry: () => outbox.current?.retry(),
  };
}
