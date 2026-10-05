import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ComponentProps, ReactNode } from "react";
import { Platform } from "react-native";
import { RealtimeAssistantSheet } from "./RealtimeAssistantSheet";
import { beginForegroundHandoff } from "../../lib/foreground-handoff";

type AssistantTarget = Pick<
  ComponentProps<typeof RealtimeAssistantSheet>,
  | "environmentId"
  | "projectId"
  | "threadId"
  | "environmentLabel"
  | "projectTitle"
  | "threadTitle"
  | "messages"
>;

const AssistantHostContext = createContext<{
  open(target: AssistantTarget): void;
} | null>(null);

/** Keep one attached call owner mounted when navigation changes underneath it. */
export function RealtimeAssistantHost(props: { children: ReactNode }) {
  const [target, setTarget] = useState<AssistantTarget | null>(null);
  const [openRequest, setOpenRequest] = useState(0);
  const callRequested = useRef(false);
  const releaseUpdateHold = useRef<(() => void) | null>(null);
  const onCallStateChange = useCallback((requested: boolean) => {
    callRequested.current = requested;
    if (requested) releaseUpdateHold.current ??= beginForegroundHandoff();
    else {
      releaseUpdateHold.current?.();
      releaseUpdateHold.current = null;
    }
  }, []);
  useEffect(() => () => releaseUpdateHold.current?.(), []);
  const open = useCallback((next: AssistantTarget) => {
    if (Platform.OS !== "android") return;
    setTarget((current) => {
      if (current && callRequested.current) return current;
      if (
        current?.environmentId === next.environmentId &&
        current.projectId === next.projectId &&
        current.threadId === next.threadId
      )
        return { ...current, messages: next.messages };
      return { ...next, messages: [...next.messages] };
    });
    setOpenRequest((current) => current + 1);
  }, []);
  const value = useMemo(() => ({ open }), [open]);
  return (
    <AssistantHostContext.Provider value={value}>
      {props.children}
      {target ? (
        <RealtimeAssistantSheet
          key={JSON.stringify([target.environmentId, target.projectId, target.threadId])}
          {...target}
          openRequest={openRequest}
          onCallStateChange={onCallStateChange}
          onClose={() => {
            if (!callRequested.current) setTarget(null);
          }}
        />
      ) : null}
    </AssistantHostContext.Provider>
  );
}

export function useRealtimeAssistantHost() {
  const host = useContext(AssistantHostContext);
  if (!host) throw new Error("Realtime assistant host is unavailable.");
  return host;
}
