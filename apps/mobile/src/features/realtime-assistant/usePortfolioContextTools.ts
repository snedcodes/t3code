import {
  createEnvironmentPortfolioContextReadCommand,
  createPortfolioContextSourcesCommand,
} from "@t3tools/client-runtime/state/portfolioContextHttp";
import { EnvironmentId, PortfolioContextReadRequest, PositiveInt } from "@t3tools/contracts";
import * as Schema from "effect/Schema";
import { useMemo } from "react";

import { connectionAtomRuntime } from "../../connection/runtime";
import { useAtomCommand } from "../../state/use-atom-command";
import type { RealtimeContextTools } from "./realtimeAssistantTransport";

const readCommand = createEnvironmentPortfolioContextReadCommand(connectionAtomRuntime);
const sourcesCommand = createPortfolioContextSourcesCommand(connectionAtomRuntime);
const decodeRequest = Schema.decodeUnknownSync(
  Schema.Struct({
    ...PortfolioContextReadRequest.fields,
    limit: Schema.optional(PositiveInt.check(Schema.isLessThanOrEqualTo(100))),
    maxChars: Schema.optional(PositiveInt.check(Schema.isLessThanOrEqualTo(60000))),
  }),
);
const decodeEnvironmentId = Schema.decodeUnknownSync(EnvironmentId);

/** Omitted environment selects this sheet's target; explicit IDs never fall back. */
export function usePortfolioContextTools(
  defaultEnvironmentId: EnvironmentId,
): RealtimeContextTools {
  const read = useAtomCommand(readCommand, { reportFailure: false, reportDefect: false });
  const sources = useAtomCommand(sourcesCommand, { reportFailure: false, reportDefect: false });
  return useMemo(
    () => ({
      async sources() {
        const result = await sources(undefined);
        if (result._tag === "Failure") throw new Error("Context sources are unavailable.");
        return result.value;
      },
      async read(input) {
        try {
          const { environmentId, ...request } = input;
          const result = await read({
            environmentId:
              environmentId === undefined
                ? defaultEnvironmentId
                : decodeEnvironmentId(environmentId),
            input: decodeRequest(request, { onExcessProperty: "error" }),
          });
          if (result._tag === "Failure") throw new Error();
          return result.value;
        } catch {
          throw new Error("Context read is unavailable or invalid for the requested environment.");
        }
      },
    }),
    [defaultEnvironmentId, read, sources],
  );
}
