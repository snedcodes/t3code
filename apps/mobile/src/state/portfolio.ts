import { createPortfolioEnvironmentAtoms } from "@t3tools/client-runtime/state/portfolio";
import type {
  EnvironmentId,
  PortfolioHeartbeatRecordsReadback,
  PortfolioTasksReadback,
  PortfolioWishlistsReadback,
} from "@t3tools/contracts";
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

export function usePortfolioTasks(environmentId: EnvironmentId | null) {
  const serverConfig = useEnvironmentServerConfig(environmentId);
  const supported =
    serverConfig === null || serverConfig.environment.capabilities.portfolioHeartbeatOwner === true;
  if (environmentId === null || !supported)
    return useEnvironmentQuery<PortfolioTasksReadback, unknown>(null);
  return useEnvironmentQuery<PortfolioTasksReadback, unknown>(
    portfolioEnvironment.tasks(environmentId),
  );
}

export function usePortfolioWishlists(environmentId: EnvironmentId | null) {
  const serverConfig = useEnvironmentServerConfig(environmentId);
  const supported =
    serverConfig === null || serverConfig.environment.capabilities.portfolioHeartbeatOwner === true;
  if (environmentId === null || !supported) {
    return useEnvironmentQuery<PortfolioWishlistsReadback, unknown>(null);
  }
  return useEnvironmentQuery<PortfolioWishlistsReadback, unknown>(
    portfolioEnvironment.wishlists(environmentId),
  );
}

export function usePortfolioHeartbeatRecords(environmentId: EnvironmentId | null) {
  const serverConfig = useEnvironmentServerConfig(environmentId);
  const supported =
    serverConfig === null || serverConfig.environment.capabilities.portfolioHeartbeatOwner === true;
  if (environmentId === null || !supported) {
    return useEnvironmentQuery<PortfolioHeartbeatRecordsReadback, unknown>(null);
  }
  return useEnvironmentQuery<PortfolioHeartbeatRecordsReadback, unknown>(
    portfolioEnvironment.heartbeatRecords(environmentId),
  );
}
