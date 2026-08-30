import { useEnvironmentQuery } from "./query";
import { useEffect } from "react";
import { createPortfolioEnvironmentAtoms } from "@t3tools/client-runtime/state/portfolio";
import type { EnvironmentId } from "@t3tools/contracts";

import { connectionAtomRuntime } from "../connection/runtime";
import { useServerConfigs } from "./entities";
import { useAtomCommand } from "./use-atom-command";

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

export function usePortfolioTasks(environmentId: EnvironmentId | null) {
  const serverConfigs = useServerConfigs();
  const serverConfig = environmentId === null ? null : (serverConfigs.get(environmentId) ?? null);
  const supported =
    serverConfig === null || serverConfig.environment.capabilities.portfolioHeartbeatOwner === true;
  return useEnvironmentQuery(
    environmentId === null || !supported ? null : portfolioEnvironment.tasks(environmentId),
  );
}

export function usePortfolioWishlists(environmentId: EnvironmentId | null) {
  const serverConfigs = useServerConfigs();
  const serverConfig = environmentId === null ? null : (serverConfigs.get(environmentId) ?? null);
  const supported =
    serverConfig === null || serverConfig.environment.capabilities.portfolioHeartbeatOwner === true;
  return useEnvironmentQuery(
    environmentId === null || !supported ? null : portfolioEnvironment.wishlists(environmentId),
  );
}

export function usePortfolioHeartbeatRecords(environmentId: EnvironmentId | null) {
  const serverConfigs = useServerConfigs();
  const serverConfig = environmentId === null ? null : (serverConfigs.get(environmentId) ?? null);
  const supported =
    serverConfig === null || serverConfig.environment.capabilities.portfolioHeartbeatOwner === true;
  return useEnvironmentQuery(
    environmentId === null || !supported
      ? null
      : portfolioEnvironment.heartbeatRecords(environmentId),
  );
}

export function usePortfolioHeartbeatRemoteDispatcher(environmentId: EnvironmentId | null) {
  const recordsQuery = usePortfolioHeartbeatRecords(environmentId);
  const dispatchDueHeartbeat = useAtomCommand(portfolioEnvironment.dispatchDueHeartbeat, {
    reportFailure: false,
  });
  useEffect(() => {
    if (environmentId === null || recordsQuery.data === undefined || recordsQuery.data === null)
      return;
    for (const record of recordsQuery.data.records) {
      void dispatchDueHeartbeat({ environmentId, input: record });
    }
  }, [dispatchDueHeartbeat, environmentId, recordsQuery.data]);
  return recordsQuery;
}
