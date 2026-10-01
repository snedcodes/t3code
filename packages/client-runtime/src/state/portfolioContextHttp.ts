import {
  EnvironmentHttpCommonError,
  PortfolioContextReadRequest,
  PortfolioContextReadResponse,
} from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as SubscriptionRef from "effect/SubscriptionRef";
import { HttpClient, HttpClientRequest } from "effect/unstable/http";
import type { Atom } from "effect/unstable/reactivity";

import { RemoteEnvironmentAuthorization } from "../authorization/service.ts";
import type { PreparedConnection } from "../connection/model.ts";
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
import { createEnvironmentCommand, createRuntimeCommand } from "./runtime.ts";

const decodeRequest = Schema.decodeUnknownEffect(PortfolioContextReadRequest);
const decodeResponse = Schema.decodeUnknownEffect(PortfolioContextReadResponse);
const decodeCommonError = Schema.decodeUnknownOption(EnvironmentHttpCommonError);

/** Read context through the existing cookie, bearer and relay DPoP authorization. */
export const fetchEnvironmentPortfolioContextRead = Effect.fn(
  "clientRuntime.state.fetchEnvironmentPortfolioContextRead",
)(function* (input: {
  readonly prepared: PreparedConnection;
  readonly request: PortfolioContextReadRequest;
  readonly signer: Option.Option<ManagedRelayDpopSigner["Service"]>;
  readonly remoteAuthorization?: Option.Option<RemoteEnvironmentAuthorization["Service"]>;
  readonly timeoutMs?: number;
}) {
  const payload = yield* decodeRequest(input.request, { onExcessProperty: "error" }).pipe(
    Effect.mapError(
      () =>
        new RemoteEnvironmentAuthFetchError({
          message: "The context read target or document selection is invalid.",
          cause: "invalid_context_request",
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
    url: (base) => environmentEndpointUrl(base, "/api/context/read"),
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
                message: "The environment returned an unreadable context read response.",
                cause: "invalid_context_response",
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
                message: "The environment returned an invalid context read response.",
                cause: "invalid_context_response",
              }),
          ),
        );
        if (
          result.environmentId !== input.prepared.environmentId ||
          result.operation !== payload.operation
        ) {
          return yield* new RemoteEnvironmentAuthInvalidJsonError({
            message: "The context read response belongs to another target.",
            cause: "context_target_mismatch",
          });
        }
        return result;
      }),
  });
});

/** One uncached command against the currently prepared exact environment. */
export function createEnvironmentPortfolioContextReadCommand<R, E>(
  runtime: Atom.AtomRuntime<EnvironmentRegistry | HttpClient.HttpClient | R, E>,
) {
  return createEnvironmentCommand(runtime, {
    label: "portfolio-context:read",
    execute: (request: PortfolioContextReadRequest, _registry, environmentId) =>
      Effect.gen(function* () {
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
            message: "Connect to this enabled environment before reading context.",
            cause: "environment_not_ready",
          });
        }
        const signer = yield* Effect.serviceOption(ManagedRelayDpopSigner);
        const remoteAuthorization = yield* Effect.serviceOption(RemoteEnvironmentAuthorization);
        return yield* fetchEnvironmentPortfolioContextRead({
          prepared: prepared.value,
          request,
          signer,
          remoteAuthorization,
        });
      }),
  });
}

/** Discover every enabled source, including offline connections, without hydration. */
export function createPortfolioContextSourcesCommand<R, E>(
  runtime: Atom.AtomRuntime<EnvironmentRegistry | R, E>,
) {
  return createRuntimeCommand(runtime, {
    label: "portfolio-context:sources",
    execute: (_input: void) =>
      Effect.gen(function* () {
        const registry = yield* EnvironmentRegistry;
        const entries = yield* SubscriptionRef.get(registry.entries);
        const sources = [];
        for (const [environmentId, entry] of entries) {
          if (!entry.enabled) continue;
          const state = yield* registry.state(environmentId).pipe(Effect.option);
          sources.push({
            environmentId,
            label: entry.target.label,
            connected: Option.isSome(state) && state.value.phase === "connected",
            state: Option.isSome(state) ? state.value.phase : "unavailable",
          });
        }
        return { sources };
      }),
  });
}
