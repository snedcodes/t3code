import { CommandId, MessageId, ThreadId, type EnvironmentId } from "@t3tools/contracts";
import { useEffect, useMemo, useReducer } from "react";
import { makeQueuedMessageMetadata } from "../../lib/commandMetadata";
import { uuidv4 } from "../../lib/uuid";
import { enqueueThreadOutboxMessage } from "../../state/thread-outbox";
import { RealtimeMessageDraft } from "./realtimeMessageDraft";

export function useRealtimeMessageDraft(
  environmentId: EnvironmentId,
  projectId: string,
  threadId: string,
) {
  const tools = useMemo(
    () =>
      new RealtimeMessageDraft({
        target: { environmentId, projectId, threadId },
        identity: () => ({ ...makeQueuedMessageMetadata(), draftId: uuidv4() }),
        enqueue: (draft) =>
          enqueueThreadOutboxMessage({
            environmentId,
            threadId: ThreadId.make(threadId),
            messageId: MessageId.make(draft.messageId),
            commandId: CommandId.make(draft.commandId),
            text: draft.text,
            createdAt: draft.createdAt,
            attachments: [],
          }),
      }),
    [environmentId, projectId, threadId],
  );
  const [, render] = useReducer((revision: number) => revision + 1, 0);
  useEffect(() => tools.subscribe(render), [tools]);
  return { tools, ...tools.snapshot() };
}
