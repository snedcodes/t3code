import {
  CommandId,
  MessageId,
  type EnvironmentId,
  type PortfolioHeartbeat,
  type PortfolioHeartbeatWriteRequest,
  type PortfolioTaskWriteRequest,
  type OrchestrationShellSnapshot,
} from "@t3tools/contracts";
import * as Crypto from "effect/Crypto";
import * as Data from "effect/Data";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as SubscriptionRef from "effect/SubscriptionRef";
import { Atom } from "effect/unstable/reactivity";

import type { EnvironmentRegistry } from "../connection/registry.ts";
import { EnvironmentSupervisor } from "../connection/supervisor.ts";
import { createAtomCommandScheduler, createEnvironmentCommand, createEnvironmentQueryAtomFamily } from "./runtime.ts";
import { PortfolioOwnerLoader } from "./portfolioHttp.ts";
import { createThreadEnvironmentAtoms } from "./threadCommands.ts";
import { buildPortfolioHeartbeatPrompt, isPortfolioHeartbeatDue } from "./portfolioHeartbeatDispatch.ts";

export class PortfolioConnectionNotReadyError extends Data.TaggedError("PortfolioConnectionNotReadyError")<{
  readonly environmentId: EnvironmentId;
  readonly message: string;
}> {}

export function createPortfolioEnvironmentAtoms<R, E>(
  runtime: Atom.AtomRuntime<EnvironmentRegistry | PortfolioOwnerLoader | Crypto.Crypto | R, E>,
  snapshotAtom: (environmentId: EnvironmentId) => Atom.Atom<OrchestrationShellSnapshot | null>,
) {
  const scheduler = createAtomCommandScheduler();
  const threadEnvironment = createThreadEnvironmentAtoms(runtime, snapshotAtom);
  const tasks = createEnvironmentQueryAtomFamily(runtime, {
    label: "environment-data:portfolio:tasks",
    staleTimeMs: 30_000,
    refreshIntervalMs: 60_000,
    execute: () => Effect.gen(function* () {
      const supervisor = yield* EnvironmentSupervisor;
      const loader = yield* PortfolioOwnerLoader;
      const prepared = yield* SubscriptionRef.get(supervisor.prepared);
      if (Option.isNone(prepared)) return yield* new PortfolioConnectionNotReadyError({ environmentId: supervisor.target.environmentId, message: `Environment ${supervisor.target.environmentId} is not connected yet.` });
      return yield* loader.tasks(prepared.value);
    }),
  });
  const heartbeats = createEnvironmentQueryAtomFamily(runtime, {
    label: "environment-data:portfolio:heartbeats",
    staleTimeMs: 15_000,
    refreshIntervalMs: 15_000,
    execute: () => Effect.gen(function* () {
      const supervisor = yield* EnvironmentSupervisor;
      const loader = yield* PortfolioOwnerLoader;
      const prepared = yield* SubscriptionRef.get(supervisor.prepared);
      if (Option.isNone(prepared)) return yield* new PortfolioConnectionNotReadyError({ environmentId: supervisor.target.environmentId, message: `Environment ${supervisor.target.environmentId} is not connected yet.` });
      return yield* loader.heartbeats(prepared.value);
    }),
  });
  const writeTask = createEnvironmentCommand(runtime, {
    label: "environment-data:commands:portfolio:write-task",
    scheduler,
    execute: (payload: PortfolioTaskWriteRequest, registry, environmentId) => Effect.gen(function* () {
      const supervisor = yield* EnvironmentSupervisor;
      const loader = yield* PortfolioOwnerLoader;
      const prepared = yield* SubscriptionRef.get(supervisor.prepared);
      if (Option.isNone(prepared)) return yield* new PortfolioConnectionNotReadyError({ environmentId, message: `Environment ${environmentId} is not connected yet.` });
      const result = yield* loader.writeTask(prepared.value, payload);
      registry.refresh(tasks({ environmentId, input: {} }));
      registry.refresh(heartbeats({ environmentId, input: {} }));
      return result;
    }),
  });
  const writeHeartbeat = createEnvironmentCommand(runtime, {
    label: "environment-data:commands:portfolio:write-heartbeat",
    scheduler,
    execute: (payload: PortfolioHeartbeatWriteRequest, registry, environmentId) => Effect.gen(function* () {
      const supervisor = yield* EnvironmentSupervisor;
      const loader = yield* PortfolioOwnerLoader;
      const prepared = yield* SubscriptionRef.get(supervisor.prepared);
      if (Option.isNone(prepared)) return yield* new PortfolioConnectionNotReadyError({ environmentId, message: `Environment ${environmentId} is not connected yet.` });
      const result = yield* loader.writeHeartbeat(prepared.value, payload);
      registry.refresh(heartbeats({ environmentId, input: {} }));
      return result;
    }),
  });
  const dispatchDueHeartbeat = createEnvironmentCommand(runtime, {
    label: "environment-data:commands:portfolio:dispatch-due-heartbeat",
    scheduler,
    concurrency: {
      mode: "singleFlight" as const,
      key: ({ environmentId, input }: { readonly environmentId: EnvironmentId; readonly input: PortfolioHeartbeat }) => `${environmentId}:${input.heartbeatId}`,
    },
    execute: (heartbeat: PortfolioHeartbeat, registry, ownerEnvironmentId) => Effect.gen(function* () {
      const now = yield* DateTime.now;
      const nowIso = DateTime.formatIso(now);
      if (!isPortfolioHeartbeatDue(heartbeat, nowIso)) return { accepted: false as const, reason: "not-due" };
      const supervisor = yield* EnvironmentSupervisor;
      const loader = yield* PortfolioOwnerLoader;
      const prepared = yield* SubscriptionRef.get(supervisor.prepared);
      if (Option.isNone(prepared)) return yield* new PortfolioConnectionNotReadyError({ environmentId: ownerEnvironmentId, message: `Environment ${ownerEnvironmentId} is not connected yet.` });
      const taskReadback = heartbeat.taskId === null ? null : yield* loader.tasks(prepared.value);
      const task = taskReadback?.tasks.find((entry) => entry.taskId === heartbeat.taskId) ?? null;
      const runNumber = heartbeat.runCount + 1;
      const commandId = `heartbeat-${heartbeat.heartbeatId}-run-${runNumber}`;
      const message = buildPortfolioHeartbeatPrompt(heartbeat, task);
      const dispatched = yield* Effect.promise(() => threadEnvironment.startTurn.run(registry, {
        environmentId: heartbeat.target.environmentId,
        input: {
          commandId: CommandId.make(commandId),
          threadId: heartbeat.target.threadId,
          message: { messageId: MessageId.make(`${commandId}-message`), role: "user", text: message, attachments: [] },
          runtimeMode: "full-access",
          interactionMode: "default",
          createdAt: nowIso,
        },
      }));
      const accepted = dispatched._tag === "Success";
      const sequence = accepted ? dispatched.value.sequence : undefined;
      const detail = accepted ? `Remote native Heartbeat accepted by target environment (sequence ${sequence}).` : `Remote native Heartbeat rejected: ${JSON.stringify(dispatched.cause)}`;
      const nextRunAt = accepted && heartbeat.cadenceMinutes !== null && (heartbeat.maxRuns === null || runNumber < heartbeat.maxRuns)
        ? DateTime.formatIso(DateTime.add(now, { minutes: heartbeat.cadenceMinutes })) : null;
      const receipt = { commandId, target: heartbeat.target, status: accepted ? "dispatched" as const : "failed" as const, ...(sequence === undefined ? {} : { sequence }), observedAt: nowIso, detail };
      const updated = yield* loader.writeHeartbeat(prepared.value, { expectedRevision: heartbeat.revision, heartbeat: {
        ...heartbeat, status: accepted ? (nextRunAt === null ? "completed" : "active") : "blocked", runCount: accepted ? runNumber : heartbeat.runCount,
        nextRunAt, lastReceipt: receipt, stopReason: accepted ? null : detail, updatedAt: nowIso,
      } });
      registry.refresh(heartbeats({ environmentId: ownerEnvironmentId, input: {} }));
      return { accepted, receipt, updated };
    }),
  });
  return { tasks, heartbeats, writeTask, writeHeartbeat, dispatchDueHeartbeat };
}
