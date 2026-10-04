import {
  EnvironmentHttpCommonError,
  RealtimeConversationOpenRequest,
  RealtimeConversationOpenResponse,
  RealtimeConversationMessagesRequest,
  RealtimeConversationMessagesResponse,
} from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as SubscriptionRef from "effect/SubscriptionRef";
import { HttpClient, HttpClientRequest } from "effect/unstable/http";
import type { Atom } from "effect/unstable/reactivity";
import { RemoteEnvironmentAuthorization } from "../authorization/service.ts";
import { EnvironmentRegistry } from "../connection/registry.ts";
import { EnvironmentSupervisor } from "../connection/supervisor.ts";
import { environmentEndpointUrl } from "../environment/endpoint.ts";
import { ManagedRelayDpopSigner } from "../relay/managedRelay.ts";
import {
  RemoteEnvironmentAuthFetchError,
  RemoteEnvironmentAuthInvalidJsonError,
  RemoteEnvironmentAuthUndeclaredStatusError,
} from "../rpc/http.ts";
import { executeAuthenticatedEnvironmentHttpRequest } from "./environmentHttpAuth.ts";
import { createEnvironmentCommand } from "./runtime.ts";
import type { EnvironmentId } from "@t3tools/contracts";

const invalidResponse = () =>
  new RemoteEnvironmentAuthInvalidJsonError({
    message: "The environment returned an invalid voice conversation response.",
    cause: "invalid_voice_conversation_response",
  });
const decodeOpenRequest = Schema.decodeUnknownEffect(RealtimeConversationOpenRequest);
const decodeOpenResponse = Schema.decodeUnknownEffect(RealtimeConversationOpenResponse);
const decodeMessagesRequest = Schema.decodeUnknownEffect(RealtimeConversationMessagesRequest);
const decodeMessagesResponse = Schema.decodeUnknownEffect(RealtimeConversationMessagesResponse);
const decodeCommonError = Schema.decodeUnknownOption(EnvironmentHttpCommonError);
const prepare = Effect.fn("realtimeConversationHttp.prepare")(function* (
  environmentId: EnvironmentId,
) {
  const registry = yield* EnvironmentRegistry;
  const entry = (yield* SubscriptionRef.get(registry.entries)).get(environmentId);
  const supervisor = yield* EnvironmentSupervisor;
  const prepared = yield* SubscriptionRef.get(supervisor.prepared);
  const state = yield* SubscriptionRef.get(supervisor.state);
  if (
    !entry?.enabled ||
    state.phase !== "connected" ||
    Option.isNone(prepared) ||
    prepared.value.environmentId !== environmentId
  ) {
    return yield* new RemoteEnvironmentAuthFetchError({
      message: "Connect to this environment to load or save voice conversation.",
      cause: "environment_not_ready",
    });
  }
  return {
    prepared: prepared.value,
    signer: yield* Effect.serviceOption(ManagedRelayDpopSigner),
    remoteAuthorization: yield* Effect.serviceOption(RemoteEnvironmentAuthorization),
  };
});

type Prepared = Effect.Success<ReturnType<typeof prepare>>;
const post = Effect.fn("realtimeConversationHttp.post")(function* (
  input: Prepared & { route: "open" | "messages"; payload: unknown },
) {
  const http = yield* HttpClient.HttpClient;
  return yield* executeAuthenticatedEnvironmentHttpRequest({
    ...input,
    group: "metadata",
    method: "POST",
    url: (base) => environmentEndpointUrl(base, `/api/realtime/conversations/${input.route}`),
    timeoutMs: 20000,
    request: ({ headers, requestUrl }) =>
      Effect.gen(function* () {
        const request = yield* HttpClientRequest.bodyJson(
          HttpClientRequest.post(requestUrl).pipe(HttpClientRequest.setHeaders({ ...headers })),
          input.payload,
        );
        const response = yield* http.execute(request);
        const body = yield* response.json.pipe(Effect.mapError(invalidResponse));
        if (response.status < 200 || response.status >= 300) {
          const common = decodeCommonError(body);
          if (Option.isSome(common)) return yield* common.value;
          return yield* new RemoteEnvironmentAuthUndeclaredStatusError(requestUrl, response.status);
        }
        return body;
      }),
  });
});

export const fetchEnvironmentRealtimeConversationOpen = Effect.fn("realtimeConversationHttp.open")(
  function* (input: Prepared & { request: RealtimeConversationOpenRequest }) {
    const payload = yield* decodeOpenRequest(input.request, { onExcessProperty: "error" });
    const body = yield* post({ ...input, route: "open", payload });
    return yield* decodeOpenResponse(body).pipe(Effect.mapError(invalidResponse));
  },
);

export const fetchEnvironmentRealtimeConversationMessages = Effect.fn(
  "realtimeConversationHttp.messages",
)(function* (input: Prepared & { request: RealtimeConversationMessagesRequest }) {
  const payload = yield* decodeMessagesRequest(input.request, { onExcessProperty: "error" });
  const body = yield* post({ ...input, route: "messages", payload });
  const result = yield* decodeMessagesResponse(body).pipe(Effect.mapError(invalidResponse));
  if (result.conversationThreadId !== payload.conversationThreadId) return yield* invalidResponse();
  return result;
});

/** Current exact connection auth, including cookie and native relay DPoP renewal. */
export function createEnvironmentRealtimeConversationCommands<R, E>(
  runtime: Atom.AtomRuntime<EnvironmentRegistry | HttpClient.HttpClient | R, E>,
) {
  return {
    open: createEnvironmentCommand(runtime, {
      label: "realtime-conversation:open",
      execute: (request: RealtimeConversationOpenRequest, _registry, environmentId) =>
        Effect.gen(function* () {
          return yield* fetchEnvironmentRealtimeConversationOpen({
            ...(yield* prepare(environmentId)),
            request,
          });
        }),
    }),
    save: createEnvironmentCommand(runtime, {
      label: "realtime-conversation:save",
      execute: (request: RealtimeConversationMessagesRequest, _registry, environmentId) =>
        Effect.gen(function* () {
          return yield* fetchEnvironmentRealtimeConversationMessages({
            ...(yield* prepare(environmentId)),
            request,
          });
        }),
    }),
  };
}
