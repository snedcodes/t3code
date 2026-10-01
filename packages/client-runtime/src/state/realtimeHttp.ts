import {
  EnvironmentHttpCommonError,
  RealtimeClientSecretRequest,
  RealtimeClientSecretResponse,
} from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as SubscriptionRef from "effect/SubscriptionRef";
import { HttpClient, HttpClientRequest } from "effect/unstable/http";
import type { Atom } from "effect/unstable/reactivity";

import { RemoteEnvironmentAuthorization } from "../authorization/service.ts";
import type { PreparedConnection } from "../connection/model.ts";
import type { EnvironmentRegistry } from "../connection/registry.ts";
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

const decodeRequest = Schema.decodeUnknownEffect(RealtimeClientSecretRequest);
const decodeResponse = Schema.decodeUnknownEffect(RealtimeClientSecretResponse);
const decodeCommonError = Schema.decodeUnknownOption(EnvironmentHttpCommonError);

/** Returns an ephemeral credential directly to the transport; never persists it. */
export const fetchEnvironmentRealtimeClientSecret = Effect.fn(
  "clientRuntime.state.fetchEnvironmentRealtimeClientSecret",
)(function* (input: {
  readonly prepared: PreparedConnection;
  readonly request: RealtimeClientSecretRequest;
  readonly signer: Option.Option<ManagedRelayDpopSigner["Service"]>;
  readonly remoteAuthorization?: Option.Option<RemoteEnvironmentAuthorization["Service"]>;
  readonly timeoutMs?: number;
}) {
  const payload = yield* decodeRequest(input.request, { onExcessProperty: "error" }).pipe(
    Effect.mapError(
      () =>
        new RemoteEnvironmentAuthFetchError({
          message: "The voice session target or document selection is invalid.",
          cause: "invalid_realtime_request",
        }),
    ),
  );
  const http = yield* HttpClient.HttpClient;
  return yield* executeAuthenticatedEnvironmentHttpRequest({
    prepared: input.prepared,
    signer: input.signer,
    ...(input.remoteAuthorization === undefined
      ? {}
      : { remoteAuthorization: input.remoteAuthorization }),
    group: "metadata",
    method: "POST",
    url: (base) => environmentEndpointUrl(base, "/api/realtime/client-secrets"),
    timeoutMs: input.timeoutMs ?? 20_000,
    request: ({ headers, requestUrl }) =>
      Effect.gen(function* () {
        const request = yield* HttpClientRequest.bodyJson(
          HttpClientRequest.post(requestUrl).pipe(HttpClientRequest.setHeaders({ ...headers })),
          payload,
        );
        const response = yield* http.execute(request);
        const body = yield* response.json.pipe(
          Effect.mapError(
            () =>
              new RemoteEnvironmentAuthInvalidJsonError({
                message: "The environment returned an unreadable voice session response.",
                cause: "invalid_realtime_response",
              }),
          ),
        );
        if (response.status < 200 || response.status >= 300) {
          const common = decodeCommonError(body);
          if (Option.isSome(common)) return yield* common.value;
          // Do not reflect arbitrary upstream text or a credential-bearing response.
          return yield* new RemoteEnvironmentAuthUndeclaredStatusError(requestUrl, response.status);
        }
        const result = yield* decodeResponse(body).pipe(
          Effect.mapError(
            () =>
              new RemoteEnvironmentAuthInvalidJsonError({
                message: "The environment returned an invalid voice session response.",
                cause: "invalid_realtime_response",
              }),
          ),
        );
        if (
          result.context.projectId !== payload.projectId ||
          result.context.threadId !== payload.threadId
        ) {
          return yield* new RemoteEnvironmentAuthInvalidJsonError({
            message: "The voice session response belongs to another thread.",
            cause: "realtime_target_mismatch",
          });
        }
        return result;
      }),
  });
});

/** One uncached command against the currently prepared exact environment. */
export function createEnvironmentRealtimeBootstrapCommand<R, E>(
  runtime: Atom.AtomRuntime<EnvironmentRegistry | HttpClient.HttpClient | R, E>,
) {
  return createEnvironmentCommand(runtime, {
    label: "realtime:bootstrap",
    execute: (request: RealtimeClientSecretRequest) =>
      Effect.gen(function* () {
        const supervisor = yield* EnvironmentSupervisor;
        const prepared = yield* SubscriptionRef.get(supervisor.prepared);
        if (Option.isNone(prepared)) {
          return yield* new RemoteEnvironmentAuthFetchError({
            message: "Connect to this environment before starting voice.",
            cause: "environment_not_ready",
          });
        }
        const signer = yield* Effect.serviceOption(ManagedRelayDpopSigner);
        const remoteAuthorization = yield* Effect.serviceOption(RemoteEnvironmentAuthorization);
        return yield* fetchEnvironmentRealtimeClientSecret({
          prepared: prepared.value,
          request,
          signer,
          remoteAuthorization,
        });
      }),
  });
}
