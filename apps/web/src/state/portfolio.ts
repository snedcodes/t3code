import { useEnvironmentQuery } from "./query";
import { createPortfolioEnvironmentAtoms } from "@t3tools/client-runtime/state/portfolio";
import type { EnvironmentId } from "@t3tools/contracts";

import { connectionAtomRuntime } from "../connection/runtime";
import { useServerConfigs } from "./entities";

export const portfolioEnvironment = createPortfolioEnvironmentAtoms(connectionAtomRuntime);

export function usePortfolioHeartbeatOwner(environmentId: EnvironmentId | null) {
  const serverConfigs = useServerConfigs();
  const serverConfig = environmentId === null ? null : (serverConfigs.get(environmentId) ?? null);
  const supported =
    serverConfig === null || serverConfig.environment.capabilities.portfolioHeartbeatOwner === true;
  return useEnvironmentQuery(
    environmentId === null || !supported
      ? null
      : portfolioEnvironment.heartbeatOwner(environmentId),
  );
}

export function usePortfolioHeartbeatOwnerPair(
  sourceEnvironmentId: EnvironmentId | null,
  targetEnvironmentId: EnvironmentId | null,
) {
  return {
    source: usePortfolioHeartbeatOwner(sourceEnvironmentId),
    target: usePortfolioHeartbeatOwner(targetEnvironmentId),
  };
}
