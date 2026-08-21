import { createPortfolioEnvironmentAtoms } from "@t3tools/client-runtime/state/portfolio";
import type { EnvironmentId } from "@t3tools/contracts";
import { useEnvironmentQuery } from "./query";

import { connectionAtomRuntime } from "../connection/runtime";
import { useEnvironmentServerConfig } from "./entities";

export const portfolioEnvironment = createPortfolioEnvironmentAtoms(connectionAtomRuntime);

/**
 * Reads Heartbeat owner state from the selected native T3 environment. The
 * environment catalog and shared connection supervisor remain authoritative;
 * Mobile does not create a Portfolio registry of its own.
 */
export function usePortfolioHeartbeatOwner(environmentId: EnvironmentId | null) {
  const serverConfig = useEnvironmentServerConfig(environmentId);
  const supported =
    serverConfig === null || serverConfig.environment.capabilities.portfolioHeartbeatOwner === true;
  return useEnvironmentQuery(
    environmentId === null || !supported
      ? null
      : portfolioEnvironment.heartbeatOwner(environmentId),
  );
}
