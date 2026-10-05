import { createEnvironmentRealtimeBootstrapCommand } from "@t3tools/client-runtime/state/realtimeHttp";
import {
  RealtimeClientSecretRequest,
  type EnvironmentId,
  type RealtimeClientSecretResponse,
} from "@t3tools/contracts";
import * as Schema from "effect/Schema";
import * as Cause from "effect/Cause";
import { useCallback } from "react";

import { connectionAtomRuntime } from "../../connection/runtime";
import { useAtomCommand } from "../../state/use-atom-command";
import type { RealtimeTransport } from "./realtimeAssistantController";
import { RealtimeTransportError } from "./realtimeAssistantTransport";

const bootstrapCommand = createEnvironmentRealtimeBootstrapCommand(connectionAtomRuntime);
const decodeRequest = Schema.decodeUnknownSync(RealtimeClientSecretRequest);

function transientBootstrapError(error: unknown, depth = 0): boolean {
  if (depth > 4 || typeof error !== "object" || error === null) return false;
  const value = error as Record<string, unknown>;
  switch (value._tag) {
    case "RemoteEnvironmentAuthTimeoutError":
    case "ManagedRelayRequestTimeoutError":
    case "RelayEnvironmentEndpointTimedOutError":
    case "RelayEnvironmentEndpointUnavailableError":
    case "RelayEnvironmentLinkUnavailableError":
      return true;
    case "ConnectionTransientError":
      return (
        typeof value.reason === "string" &&
        ["network", "timeout", "transport", "endpoint-unavailable", "relay-unavailable"].includes(
          value.reason,
        )
      );
    case "HttpClientError": {
      const reason = value.reason;
      return (
        typeof reason === "object" &&
        reason !== null &&
        "_tag" in reason &&
        reason._tag === "TransportError"
      );
    }
    case "RemoteEnvironmentAuthFetchError":
      // This wrapper also carries invalid requests and DPoP/configuration failures.
      return (
        value.cause === "environment_not_ready" || transientBootstrapError(value.cause, depth + 1)
      );
    case "RemoteEnvironmentAuthUndeclaredStatusError":
      // 502/503 here also represent upstream auth, malformed output, and missing config.
      return value.status === 408 || value.status === 504;
    default:
      return false;
  }
}

/** Every cause entry must be a known transient failure; interruption/defects remain final. */
export function realtimeBootstrapFailure(cause: Cause.Cause<unknown>): RealtimeTransportError {
  const transient =
    cause.reasons.length > 0 &&
    cause.reasons.every(
      (reason) => Cause.isFailReason(reason) && transientBootstrapError(reason.error),
    );
  return new RealtimeTransportError(
    transient
      ? "Voice environment connection temporarily unavailable."
      : "Could not start voice in this environment. Check its connection and server voice configuration.",
    transient ? "network-failed" : undefined,
  );
}

/** Bind the transport bootstrap to one environment, using existing connection auth. */
export function useRealtimeBootstrap(environmentId: EnvironmentId) {
  const run = useAtomCommand(bootstrapCommand, { reportFailure: false, reportDefect: false });
  return useCallback(
    async (
      request: Parameters<RealtimeTransport["start"]>[0],
    ): Promise<RealtimeClientSecretResponse> => {
      const result = await run({
        environmentId,
        input: decodeRequest(request, { onExcessProperty: "error" }),
      });
      if (result._tag === "Failure") throw realtimeBootstrapFailure(result.cause);
      return result.value;
    },
    [environmentId, run],
  );
}
