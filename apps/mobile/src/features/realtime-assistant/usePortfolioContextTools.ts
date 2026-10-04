import {
  createEnvironmentPortfolioContextReadCommand,
  createPortfolioContextSourcesCommand,
} from "@t3tools/client-runtime/state/portfolioContextHttp";
import type { EnvironmentId } from "@t3tools/contracts";
import { useMemo } from "react";

import { connectionAtomRuntime } from "../../connection/runtime";
import { useAtomCommand } from "../../state/use-atom-command";
import type { RealtimeContextTools } from "./realtimeAssistantTransport";
import { createPortfolioContextToolRead } from "./portfolioContextToolRead";

const readCommand = createEnvironmentPortfolioContextReadCommand(connectionAtomRuntime);
const sourcesCommand = createPortfolioContextSourcesCommand(connectionAtomRuntime);

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
      read: createPortfolioContextToolRead(defaultEnvironmentId, read),
    }),
    [defaultEnvironmentId, read, sources],
  );
}
