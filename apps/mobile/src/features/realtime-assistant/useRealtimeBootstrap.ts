import { createEnvironmentRealtimeBootstrapCommand } from "@t3tools/client-runtime/state/realtimeHttp";
import {
  RealtimeClientSecretRequest,
  type EnvironmentId,
  type RealtimeClientSecretResponse,
} from "@t3tools/contracts";
import * as Schema from "effect/Schema";
import { useCallback } from "react";

import { connectionAtomRuntime } from "../../connection/runtime";
import { useAtomCommand } from "../../state/use-atom-command";
import type { RealtimeTransport } from "./realtimeAssistantController";

const bootstrapCommand = createEnvironmentRealtimeBootstrapCommand(connectionAtomRuntime);
const decodeRequest = Schema.decodeUnknownSync(RealtimeClientSecretRequest);

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
      if (result._tag === "Failure")
        throw new Error(
          "Could not start voice in this environment. Check its connection and server voice configuration.",
        );
      return result.value;
    },
    [environmentId, run],
  );
}
