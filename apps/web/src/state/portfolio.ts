import { useAtomValue } from "@effect/atom-react";
import { createElement, useEffect, useMemo } from "react";
import { AsyncResult } from "effect/unstable/reactivity";
import type { EnvironmentId } from "@t3tools/contracts";
import type { PortfolioHeartbeatRecord, PortfolioTaskView, PortfolioWishlist } from "@t3tools/contracts";

import { connectionAtomRuntime } from "../connection/runtime";
import { environmentSnapshotAtom } from "./shell";
import { usePrimaryEnvironmentId } from "./environments";
import { createPortfolioEnvironmentAtoms } from "@t3tools/client-runtime/state/portfolio";
import { useAtomCommand } from "./use-atom-command";
import { useEnvironmentQuery } from "./query";
import { toPortfolioTaskView } from "../portfolioCompatibility";

export const portfolioEnvironment = createPortfolioEnvironmentAtoms(connectionAtomRuntime, environmentSnapshotAtom);

export function usePortfolioTasks(environmentId: EnvironmentId | null) {
  const view = useEnvironmentQuery(environmentId === null ? null : portfolioEnvironment.tasks({ environmentId, input: {} }));
  return useMemo(() => ({
    ...view,
    data: view.data === null ? null : { ...view.data, tasks: view.data.tasks.map(toPortfolioTaskView) },
  }), [view]);
}

export function usePortfolioHeartbeats(environmentId: EnvironmentId) {
  return useAtomValue(portfolioEnvironment.heartbeats({ environmentId, input: {} }));
}

export function usePortfolioHeartbeatRecords(environmentId: EnvironmentId | null) {
  const view = useEnvironmentQuery(environmentId === null ? null : portfolioEnvironment.heartbeats({ environmentId, input: {} }));
  return useMemo(() => ({
    ...view,
    data: view.data === null ? null : { owner: { role: "owner" as const, freshness: "fresh" as const, descriptor: { ownerEnvironmentId: view.data.ownerEnvironmentId } }, records: view.data.heartbeats.map((heartbeat): PortfolioHeartbeatRecord => ({
      heartbeatId: heartbeat.heartbeatId,
      revision: heartbeat.revision,
      taskId: heartbeat.taskId,
      message: heartbeat.message,
      nextRunAt: heartbeat.nextRunAt,
      target: heartbeat.target,
      enabled: heartbeat.status === "active",
      activeRunId: null,
      disabledReason: heartbeat.stopReason,
      cadenceMinutes: heartbeat.cadenceMinutes,
      maxRuns: heartbeat.maxRuns,
      runCount: heartbeat.runCount,
      expiresAt: heartbeat.expiresAt,
      finishLine: null,
      stopConditions: heartbeat.stopConditions,
      preventOverlap: heartbeat.preventOverlap,
      lastReceipt: heartbeat.lastReceipt,
      updatedAt: heartbeat.updatedAt,
    })) },
  }), [view]);
}

export function usePortfolioHeartbeatOwner(environmentId: EnvironmentId | null) {
  const ownerEnvironmentId = usePrimaryEnvironmentId();
  const tasks = usePortfolioTasks(ownerEnvironmentId);
  const heartbeats = usePortfolioHeartbeatRecords(ownerEnvironmentId);
  return useMemo(() => {
    const taskReadback = tasks.data;
    const heartbeatReadback = heartbeats.data;
    if (environmentId === null || ownerEnvironmentId === null || !taskReadback || !heartbeatReadback) {
      return { data: null, error: tasks.error ?? heartbeats.error, isPending: tasks.isPending || heartbeats.isPending, isSuccess: false, refresh: () => { tasks.refresh(); heartbeats.refresh(); } };
    }
    const canonicalOwnerEnvironmentId = heartbeatReadback.owner.descriptor?.ownerEnvironmentId ?? ownerEnvironmentId;
    const taskRevision = taskReadback.tasks.reduce((revision, task) => Math.max(revision, task.revision), 0);
    const heartbeatRevision = heartbeatReadback.records.reduce((revision, heartbeat) => Math.max(revision, heartbeat.revision ?? 0), 0);
    const record = heartbeatReadback.records.find((heartbeat) => heartbeat.target.environmentId === environmentId) ?? null;
    const updatedAt = [
      ...taskReadback.tasks.map((task) => task.updatedAt),
      ...heartbeatReadback.records.map((heartbeat) => heartbeat.updatedAt),
    ].sort().at(-1) ?? null;
    return {
      data: {
        role: environmentId === canonicalOwnerEnvironmentId ? "owner" as const : "non_owner" as const,
        freshness: "fresh" as const,
        descriptor: {
          schemaVersion: "portfolio-owner-v042",
          domain: "portfolio_heartbeat" as const,
          ownerEnvironmentId: canonicalOwnerEnvironmentId,
          ownerEpoch: 0,
          ownerRevision: Math.max(taskRevision, heartbeatRevision),
          portfolioRevision: taskRevision,
          heartbeatRevision,
          portfolioChecksum: null,
          heartbeatChecksum: null,
          updatedAt,
          target: record?.target ?? null,
          lastReceipt: record?.lastReceipt ?? null,
        },
      },
      error: null,
      isPending: false,
      isSuccess: true,
      refresh: () => { tasks.refresh(); heartbeats.refresh(); },
    };
  }, [environmentId, heartbeats, ownerEnvironmentId, tasks]);
}

export function usePortfolioHeartbeatOwnerPair(sourceEnvironmentId: EnvironmentId | null, targetEnvironmentId: EnvironmentId | null) {
  return { source: usePortfolioHeartbeatOwner(sourceEnvironmentId), target: usePortfolioHeartbeatOwner(targetEnvironmentId) };
}

export function usePortfolioWishlists(environmentId: EnvironmentId | null) {
  return useEnvironmentQuery(environmentId === null ? null : portfolioEnvironment.wishlists({ environmentId, input: {} }));
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
