import { ORCHESTRATION_WS_METHODS } from "@t3tools/contracts";
import type {
  OrchestrationThreadStreamItem,
  ProviderRealtimeAudioChunk,
  ProviderRealtimeStartInput,
  ProviderRuntimeEvent,
  ThreadId,
} from "@t3tools/contracts";
import * as Stream from "effect/Stream";
import { Atom } from "effect/unstable/reactivity";
import type { EnvironmentRegistry } from "../connection/registry.ts";
import { subscribe } from "../rpc/client.ts";
import { createEnvironmentSubscriptionAtomFamily } from "./runtime.ts";

export type RealtimeStatus = "idle" | "starting" | "active" | "stopping" | "stopped" | "error";

export interface RealtimeState {
  readonly threadId: ThreadId;
  readonly status: RealtimeStatus;
  readonly realtimeSessionId?: string;
  readonly items: ReadonlyArray<unknown>;
  readonly audio: ReadonlyArray<ProviderRealtimeAudioChunk>;
  readonly error: string | undefined;
}

export function createRealtimeState(threadId: ThreadId): RealtimeState {
  return { threadId, status: "idle", items: [], audio: [], error: undefined };
}

export function realtimeStartInput(
  threadId: ThreadId,
  input: Omit<ProviderRealtimeStartInput, "threadId"> = {},
): ProviderRealtimeStartInput {
  return { threadId, ...input };
}

export function reduceRealtimeEvent(
  state: RealtimeState,
  event: Extract<ProviderRuntimeEvent, { type: `thread.realtime.${string}` }>,
): RealtimeState {
  if (event.threadId !== state.threadId) return state;
  switch (event.type) {
    case "thread.realtime.started":
      return {
        ...state,
        status: "active",
        ...(event.payload.realtimeSessionId
          ? { realtimeSessionId: event.payload.realtimeSessionId }
          : {}),
        error: undefined,
      };
    case "thread.realtime.item-added":
      return { ...state, items: [...state.items, event.payload.item] };
    case "thread.realtime.audio.delta":
      return { ...state, audio: [...state.audio, event.payload.audio] };
    case "thread.realtime.error":
      return { ...state, status: "error", error: event.payload.message };
    case "thread.realtime.closed":
      return { ...state, status: "stopped" };
  }
}

type RealtimeStreamItem = Extract<
  OrchestrationThreadStreamItem,
  { kind: "provider-runtime-event" }
>;
type RealtimeEvent = Extract<ProviderRuntimeEvent, { type: `thread.realtime.${string}` }>;

function isRealtimeStreamItem(item: OrchestrationThreadStreamItem): item is RealtimeStreamItem {
  return item.kind === "provider-runtime-event";
}

/** Folds ephemeral realtime events from the normal thread subscription. */
export function createRealtimeEnvironmentAtoms<R, E>(
  runtime: Atom.AtomRuntime<EnvironmentRegistry | R, E>,
) {
  return {
    state: createEnvironmentSubscriptionAtomFamily(runtime, {
      label: "environment-data:thread:realtime",
      subscribe: ({ threadId }: { readonly threadId: ThreadId }) =>
        subscribe(ORCHESTRATION_WS_METHODS.subscribeThread, { threadId }).pipe(
          Stream.filter(isRealtimeStreamItem),
          Stream.map((item) => item.event as RealtimeEvent),
          Stream.scan(createRealtimeState(threadId), reduceRealtimeEvent),
        ),
    }),
  };
}
