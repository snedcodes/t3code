import { useAtomValue } from "@effect/atom-react";
import { createElement, useEffect } from "react";
import { AsyncResult } from "effect/unstable/reactivity";
import type { EnvironmentId } from "@t3tools/contracts";

import { connectionAtomRuntime } from "../connection/runtime";
import { environmentSnapshotAtom } from "./shell";
import { usePrimaryEnvironmentId } from "./environments";
import { createPortfolioEnvironmentAtoms } from "@t3tools/client-runtime/state/portfolio";
import { useAtomCommand } from "./use-atom-command";

export const portfolioEnvironment = createPortfolioEnvironmentAtoms(connectionAtomRuntime, environmentSnapshotAtom);

export function usePortfolioTasks(environmentId: EnvironmentId) {
  return useAtomValue(portfolioEnvironment.tasks({ environmentId, input: {} }));
}

export function usePortfolioHeartbeats(environmentId: EnvironmentId) {
  return useAtomValue(portfolioEnvironment.heartbeats({ environmentId, input: {} }));
}

export function PortfolioHeartbeatRunner() {
  const environmentId = usePrimaryEnvironmentId();
  return environmentId === null ? null : createElement(PortfolioHeartbeatRunnerForEnvironment, { environmentId });
}

function PortfolioHeartbeatRunnerForEnvironment({ environmentId }: { readonly environmentId: EnvironmentId }) {
  const result = usePortfolioHeartbeats(environmentId);
  const dispatch = useAtomCommand(portfolioEnvironment.dispatchDueHeartbeat, { reportFailure: false });
  useEffect(() => {
    if (environmentId === null) return;
    const runDue = () => {
      if (!AsyncResult.isSuccess(result)) return;
      const now = Date.now();
      for (const heartbeat of result.value.heartbeats) {
        if (heartbeat.target.environmentId === environmentId || heartbeat.status !== "active" || heartbeat.nextRunAt === null || Date.parse(heartbeat.nextRunAt) > now) continue;
        void dispatch({ environmentId, input: heartbeat });
      }
    };
    runDue();
    const timer = window.setInterval(runDue, 15_000);
    return () => window.clearInterval(timer);
  }, [dispatch, environmentId, result]);
  return null;
}
