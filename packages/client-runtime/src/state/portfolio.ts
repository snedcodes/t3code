import {
  CommandId,
  MessageId,
  type EnvironmentId,
  type PortfolioHeartbeat,
  type PortfolioHeartbeatWriteRequest,
  type PortfolioWishlist,
  type PortfolioWishlistPromotionRequest,
  type PortfolioWishlistWriteRequest,
  type PortfolioWishlistsReadback,
  type PortfolioTaskWriteRequest,
  type PortfolioTaskView,
  type PortfolioTaskUpdateRequest,
  type PortfolioTaskStatusTransitionRequest,
  type PortfolioReceipt,
  type PortfolioHeartbeatRecord,
  type PortfolioHeartbeatOwnerClaimRequest,
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
  const wishlists = createEnvironmentQueryAtomFamily(runtime, {
    label: "environment-data:portfolio:wishlists",
    staleTimeMs: 30_000,
    refreshIntervalMs: 60_000,
    execute: () => Effect.gen(function* () {
      const supervisor = yield* EnvironmentSupervisor;
      const loader = yield* PortfolioOwnerLoader;
      const prepared = yield* SubscriptionRef.get(supervisor.prepared);
      if (Option.isNone(prepared)) return yield* new PortfolioConnectionNotReadyError({ environmentId: supervisor.target.environmentId, message: `Environment ${supervisor.target.environmentId} is not connected yet.` });
      return yield* loader.wishlists(prepared.value);
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
  const createTask = createEnvironmentCommand(runtime, {
    label: "environment-data:commands:portfolio:create-task",
    scheduler,
    execute: (task: PortfolioTaskView, registry, environmentId) => Effect.gen(function* () {
      const supervisor = yield* EnvironmentSupervisor;
      const loader = yield* PortfolioOwnerLoader;
      const prepared = yield* SubscriptionRef.get(supervisor.prepared);
      if (Option.isNone(prepared)) return yield* new PortfolioConnectionNotReadyError({ environmentId, message: `Environment ${environmentId} is not connected yet.` });
      const { assignment, ...record } = task;
      const result = yield* loader.writeTask(prepared.value, { expectedRevision: null, task: { ...record, ownerPassportId: assignment.ownerPassportId, ownerHost: assignment.ownerHost } });
      registry.refresh(tasks({ environmentId, input: {} }));
      return result;
    }),
  });
  const updateTask = createEnvironmentCommand(runtime, {
    label: "environment-data:commands:portfolio:update-task",
    scheduler,
    execute: (input: PortfolioTaskUpdateRequest, registry, environmentId) => Effect.gen(function* () {
      const supervisor = yield* EnvironmentSupervisor;
      const loader = yield* PortfolioOwnerLoader;
      const prepared = yield* SubscriptionRef.get(supervisor.prepared);
      if (Option.isNone(prepared)) return yield* new PortfolioConnectionNotReadyError({ environmentId, message: `Environment ${environmentId} is not connected yet.` });
      const readback = yield* loader.tasks(prepared.value);
      const current = readback.tasks.find((task) => task.taskId === input.taskId);
      if (!current || current.revision !== input.expectedRevision) return yield* Effect.fail(new Error("Task revision is stale or task is missing."));
      const result = yield* loader.writeTask(prepared.value, { expectedRevision: input.expectedRevision, task: { ...current, title: input.title, outcome: input.outcome, priority: input.priority, completionCondition: input.completionCondition, checklistItems: input.checklistItems, evidenceLinks: input.evidenceLinks, heartbeatId: input.heartbeatId, updatedAt: input.updatedAt } });
      registry.refresh(tasks({ environmentId, input: {} }));
      registry.refresh(heartbeats({ environmentId, input: {} }));
      return result;
    }),
  });
  const transitionTaskStatus = createEnvironmentCommand(runtime, {
    label: "environment-data:commands:portfolio:transition-task-status",
    scheduler,
    execute: (input: PortfolioTaskStatusTransitionRequest, registry, environmentId) => Effect.gen(function* () {
      const supervisor = yield* EnvironmentSupervisor;
      const loader = yield* PortfolioOwnerLoader;
      const prepared = yield* SubscriptionRef.get(supervisor.prepared);
      if (Option.isNone(prepared)) return yield* new PortfolioConnectionNotReadyError({ environmentId, message: `Environment ${environmentId} is not connected yet.` });
      const readback = yield* loader.tasks(prepared.value);
      const current = readback.tasks.find((task) => task.taskId === input.taskId);
      if (!current || current.revision !== input.expectedRevision) return yield* Effect.fail(new Error("Task revision is stale or task is missing."));
      const terminal = input.status === "complete" || input.status === "cancelled";
      const result = yield* loader.writeTask(prepared.value, { expectedRevision: input.expectedRevision, task: { ...current, status: input.status, updatedAt: input.updatedAt, completedAt: terminal ? (input.status === "complete" ? input.updatedAt : current.completedAt) : null } });
      registry.refresh(tasks({ environmentId, input: {} }));
      registry.refresh(heartbeats({ environmentId, input: {} }));
      return result;
    }),
  });
  const recordTaskReceipt = createEnvironmentCommand(runtime, {
    label: "environment-data:commands:portfolio:record-task-receipt",
    scheduler,
    execute: (input: { readonly taskId: PortfolioTaskView["taskId"]; readonly expectedRevision: number; readonly target: PortfolioTaskView["target"]; readonly receipt: PortfolioReceipt }, registry, environmentId) => Effect.gen(function* () {
      const supervisor = yield* EnvironmentSupervisor;
      const loader = yield* PortfolioOwnerLoader;
      const prepared = yield* SubscriptionRef.get(supervisor.prepared);
      if (Option.isNone(prepared)) return yield* new PortfolioConnectionNotReadyError({ environmentId, message: `Environment ${environmentId} is not connected yet.` });
      const readback = yield* loader.tasks(prepared.value);
      const current = readback.tasks.find((task) => task.taskId === input.taskId);
      if (!current || current.revision !== input.expectedRevision) return yield* Effect.fail(new Error("Task revision is stale or task is missing."));
      const result = yield* loader.writeTask(prepared.value, { expectedRevision: input.expectedRevision, task: { ...current, lastReceipt: input.receipt, updatedAt: input.receipt.observedAt } });
      registry.refresh(tasks({ environmentId, input: {} }));
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
  const writeWishlist = createEnvironmentCommand(runtime, {
    label: "environment-data:commands:portfolio:write-wishlist",
    scheduler,
    execute: (payload: PortfolioWishlistWriteRequest, registry, environmentId) => Effect.gen(function* () {
      const supervisor = yield* EnvironmentSupervisor;
      const loader = yield* PortfolioOwnerLoader;
      const prepared = yield* SubscriptionRef.get(supervisor.prepared);
      if (Option.isNone(prepared)) return yield* new PortfolioConnectionNotReadyError({ environmentId, message: `Environment ${environmentId} is not connected yet.` });
      const result = yield* loader.writeWishlist(prepared.value, payload);
      registry.refresh(wishlists({ environmentId, input: {} }));
      return result;
    }),
  });
  const createWishlist = createEnvironmentCommand(runtime, {
    label: "environment-data:commands:portfolio:create-wishlist",
    scheduler,
    execute: (wishlist: PortfolioWishlist, registry, environmentId) => Effect.gen(function* () {
      const supervisor = yield* EnvironmentSupervisor;
      const loader = yield* PortfolioOwnerLoader;
      const prepared = yield* SubscriptionRef.get(supervisor.prepared);
      if (Option.isNone(prepared)) return yield* new PortfolioConnectionNotReadyError({ environmentId, message: `Environment ${environmentId} is not connected yet.` });
      const result = yield* loader.writeWishlist(prepared.value, { expectedRevision: null, wishlist });
      registry.refresh(wishlists({ environmentId, input: {} }));
      return result;
    }),
  });
  const promoteWishlist = createEnvironmentCommand(runtime, {
    label: "environment-data:commands:portfolio:promote-wishlist",
    scheduler,
    execute: (request: PortfolioWishlistPromotionRequest, registry, environmentId) => Effect.gen(function* () {
      const supervisor = yield* EnvironmentSupervisor;
      const loader = yield* PortfolioOwnerLoader;
      const prepared = yield* SubscriptionRef.get(supervisor.prepared);
      if (Option.isNone(prepared)) return yield* new PortfolioConnectionNotReadyError({ environmentId, message: `Environment ${environmentId} is not connected yet.` });
      const current = yield* loader.wishlists(prepared.value);
      const wishlist = current.wishlists.find((entry) => entry.wishlistId === request.wishlistId);
      if (!wishlist || wishlist.revision !== request.expectedRevision) return yield* Effect.fail(new Error("Wishlist revision is stale or item is missing."));
      const result = yield* loader.writeWishlist(prepared.value, { expectedRevision: request.expectedRevision, wishlist: { ...wishlist, status: "promoted", promotedTaskId: request.promotedTaskId, updatedAt: request.updatedAt } });
      registry.refresh(wishlists({ environmentId, input: {} }));
      return result;
    }),
  });
  const upsertHeartbeatRecord = createEnvironmentCommand(runtime, {
    label: "environment-data:commands:portfolio:upsert-heartbeat-view",
    scheduler,
    execute: (record: PortfolioHeartbeatRecord, registry, environmentId) => Effect.gen(function* () {
      const now = DateTime.formatIso(yield* DateTime.now);
      const supervisor = yield* EnvironmentSupervisor;
      const loader = yield* PortfolioOwnerLoader;
      const prepared = yield* SubscriptionRef.get(supervisor.prepared);
      if (Option.isNone(prepared)) return yield* new PortfolioConnectionNotReadyError({ environmentId, message: `Environment ${environmentId} is not connected yet.` });
      const current = yield* loader.heartbeats(prepared.value);
      const previous = current.heartbeats.find((entry) => entry.heartbeatId === record.heartbeatId) ?? null;
      const zeroRunLimit = record.maxRuns === 0;
      const heartbeat: PortfolioHeartbeat = {
        heartbeatId: record.heartbeatId,
        taskId: record.taskId ?? null,
        message: record.message ?? null,
        target: record.target,
        status: zeroRunLimit ? "exhausted" : record.enabled ? "active" : "paused",
        cadenceMinutes: record.cadenceMinutes !== null && record.cadenceMinutes > 0 ? record.cadenceMinutes : null,
        nextRunAt: record.enabled && !zeroRunLimit ? record.nextRunAt ?? now : null,
        maxRuns: record.maxRuns !== null && record.maxRuns > 0 ? record.maxRuns : null,
        runCount: record.runCount,
        expiresAt: record.expiresAt,
        stopConditions: record.stopConditions,
        preventOverlap: record.preventOverlap,
        stopReason: zeroRunLimit ? "Run limit is zero." : record.enabled ? null : record.disabledReason,
        lastReceipt: record.lastReceipt,
        updatedAt: record.updatedAt,
        revision: previous?.revision ?? 1,
      };
      const result = yield* loader.writeHeartbeat(prepared.value, { expectedRevision: previous?.revision ?? null, heartbeat });
      registry.refresh(heartbeats({ environmentId, input: {} }));
      return result;
    }),
  });
  const recordHeartbeatReceipt = createEnvironmentCommand(runtime, {
    label: "environment-data:commands:portfolio:record-heartbeat-receipt",
    scheduler,
    execute: (receipt: PortfolioReceipt, registry, environmentId) => Effect.gen(function* () {
      const supervisor = yield* EnvironmentSupervisor;
      const loader = yield* PortfolioOwnerLoader;
      const prepared = yield* SubscriptionRef.get(supervisor.prepared);
      if (Option.isNone(prepared)) return yield* new PortfolioConnectionNotReadyError({ environmentId, message: `Environment ${environmentId} is not connected yet.` });
      const current = yield* loader.heartbeats(prepared.value);
      const heartbeat = current.heartbeats.find((entry) => entry.target.environmentId === receipt.target.environmentId && entry.target.projectId === receipt.target.projectId && entry.target.threadId === receipt.target.threadId);
      if (!heartbeat) return yield* Effect.fail(new Error("No Heartbeat matches the exact receipt target."));
      const result = yield* loader.writeHeartbeat(prepared.value, { expectedRevision: heartbeat.revision, heartbeat: { ...heartbeat, lastReceipt: receipt, updatedAt: receipt.observedAt } });
      registry.refresh(heartbeats({ environmentId, input: {} }));
      return result;
    }),
  });
  const claimHeartbeatOwner = createEnvironmentCommand(runtime, {
    label: "environment-data:commands:portfolio:claim-heartbeat-owner",
    scheduler,
    execute: (_request: PortfolioHeartbeatOwnerClaimRequest) => Effect.succeed({ accepted: false as boolean, reason: "unsupported" as const, descriptor: null as { readonly ownerEpoch: number } | null }),
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
  return {
    tasks,
    heartbeats,
    wishlists,
    writeTask,
    writeHeartbeat,
    writeWishlist,
    createTask,
    updateTask,
    transitionTaskStatus,
    recordTaskReceipt,
    recordHeartbeatReceipt,
    upsertHeartbeatRecord,
    claimHeartbeatOwner,
    createWishlist,
    promoteWishlist,
    dispatchDueHeartbeat,
  };
}
