import type {
  EnvironmentId,
  PortfolioHeartbeatRecord,
  PortfolioHeartbeatOwnerClaimRequest,
  PortfolioHeartbeatOwnerTransferPrepareRequest,
  PortfolioHeartbeatOwnerTransferTicket,
  PortfolioHeartbeatReceiptRecordRequest,
  PortfolioHeartbeatRecordUpsertRequest,
  PortfolioTaskCreateRequest,
  PortfolioTaskReceiptRecordRequest,
  PortfolioTaskStatusTransitionRequest,
  PortfolioWishlistCreateRequest,
  PortfolioWishlistPromotionRequest,
} from "@t3tools/contracts";
import { CommandId, MessageId } from "@t3tools/contracts";
import * as Crypto from "effect/Crypto";
import * as Data from "effect/Data";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as SubscriptionRef from "effect/SubscriptionRef";
import { Atom } from "effect/unstable/reactivity";

import type { EnvironmentRegistry } from "../connection/registry.ts";
import { EnvironmentSupervisor } from "../connection/supervisor.ts";
import {
  createAtomCommandScheduler,
  createEnvironmentCommand,
  createEnvironmentQueryAtomFamily,
  squashAtomCommandFailure,
} from "./runtime.ts";
import { PortfolioHeartbeatOwnerLoader } from "./portfolioHeartbeatOwnerHttp.ts";
import { createThreadEnvironmentAtoms } from "./threadCommands.ts";
import {
  buildPortfolioHeartbeatRemoteTurn,
  formatPortfolioHeartbeatRemoteFailure,
  isPortfolioHeartbeatDue,
} from "./portfolioHeartbeatRemoteDispatch.ts";

export class PortfolioHeartbeatOwnerConnectionNotReadyError extends Data.TaggedError(
  "PortfolioHeartbeatOwnerConnectionNotReadyError",
)<{
  readonly message: string;
}> {}

export function createPortfolioEnvironmentAtoms<R, E>(
  runtime: Atom.AtomRuntime<
    EnvironmentRegistry | PortfolioHeartbeatOwnerLoader | Crypto.Crypto | R,
    E
  >,
) {
  const claimScheduler = createAtomCommandScheduler();
  const threadEnvironment = createThreadEnvironmentAtoms(runtime);
  const heartbeatOwnerQuery = createEnvironmentQueryAtomFamily(runtime, {
    label: "environment-data:portfolio:heartbeat-owner",
    staleTimeMs: 30_000,
    refreshIntervalMs: 60_000,
    execute: () =>
      Effect.gen(function* () {
        const supervisor = yield* EnvironmentSupervisor;
        const loader = yield* PortfolioHeartbeatOwnerLoader;
        const prepared = yield* SubscriptionRef.get(supervisor.prepared);
        if (Option.isNone(prepared)) {
          return yield* new PortfolioHeartbeatOwnerConnectionNotReadyError({
            message: "The native environment connection is not ready.",
          });
        }
        return yield* loader.load(prepared.value);
      }),
  });
  const tasksQuery = createEnvironmentQueryAtomFamily(runtime, {
    label: "environment-data:portfolio:tasks",
    staleTimeMs: 30_000,
    refreshIntervalMs: 60_000,
    execute: () =>
      Effect.gen(function* () {
        const supervisor = yield* EnvironmentSupervisor;
        const loader = yield* PortfolioHeartbeatOwnerLoader;
        const prepared = yield* SubscriptionRef.get(supervisor.prepared);
        if (Option.isNone(prepared)) {
          return yield* new PortfolioHeartbeatOwnerConnectionNotReadyError({
            message: "The native environment connection is not ready.",
          });
        }
        return yield* loader.tasks(prepared.value);
      }),
  });
  const wishlistsQuery = createEnvironmentQueryAtomFamily(runtime, {
    label: "environment-data:portfolio:wishlists",
    staleTimeMs: 30_000,
    refreshIntervalMs: 60_000,
    execute: () =>
      Effect.gen(function* () {
        const supervisor = yield* EnvironmentSupervisor;
        const loader = yield* PortfolioHeartbeatOwnerLoader;
        const prepared = yield* SubscriptionRef.get(supervisor.prepared);
        if (Option.isNone(prepared))
          return yield* new PortfolioHeartbeatOwnerConnectionNotReadyError({
            message: "The native environment connection is not ready.",
          });
        return yield* loader.wishlists(prepared.value);
      }),
  });
  const heartbeatRecordsQuery = createEnvironmentQueryAtomFamily(runtime, {
    label: "environment-data:portfolio:heartbeat-records",
    staleTimeMs: 30_000,
    refreshIntervalMs: 60_000,
    execute: () =>
      Effect.gen(function* () {
        const supervisor = yield* EnvironmentSupervisor;
        const loader = yield* PortfolioHeartbeatOwnerLoader;
        const prepared = yield* SubscriptionRef.get(supervisor.prepared);
        if (Option.isNone(prepared))
          return yield* new PortfolioHeartbeatOwnerConnectionNotReadyError({
            message: "The native environment connection is not ready.",
          });
        return yield* loader.heartbeatRecords(prepared.value);
      }),
  });

  const claimHeartbeatOwner = createEnvironmentCommand(runtime, {
    label: "environment-data:commands:portfolio:claim-heartbeat-owner",
    scheduler: claimScheduler,
    concurrency: {
      mode: "singleFlight" as const,
      key: ({ environmentId }: { readonly environmentId: EnvironmentId }) => String(environmentId),
    },
    execute: (input: PortfolioHeartbeatOwnerClaimRequest, registry, environmentId) =>
      Effect.gen(function* () {
        const supervisor = yield* EnvironmentSupervisor;
        const loader = yield* PortfolioHeartbeatOwnerLoader;
        const prepared = yield* SubscriptionRef.get(supervisor.prepared);
        if (Option.isNone(prepared)) {
          return yield* new PortfolioHeartbeatOwnerConnectionNotReadyError({
            message: "The native environment connection is not ready.",
          });
        }
        const result = yield* loader.claim(prepared.value, input);
        registry.refresh(heartbeatOwnerQuery({ environmentId, input: {} }));
        return result;
      }),
  });

  const recordHeartbeatReceipt = createEnvironmentCommand(runtime, {
    label: "environment-data:commands:portfolio:record-heartbeat-receipt",
    scheduler: claimScheduler,
    concurrency: {
      mode: "singleFlight" as const,
      key: ({ environmentId }: { readonly environmentId: EnvironmentId }) => String(environmentId),
    },
    execute: (input: PortfolioHeartbeatReceiptRecordRequest, registry, environmentId) =>
      Effect.gen(function* () {
        const supervisor = yield* EnvironmentSupervisor;
        const loader = yield* PortfolioHeartbeatOwnerLoader;
        const prepared = yield* SubscriptionRef.get(supervisor.prepared);
        if (Option.isNone(prepared)) {
          return yield* new PortfolioHeartbeatOwnerConnectionNotReadyError({
            message: "The native environment connection is not ready.",
          });
        }
        const result = yield* loader.recordReceipt(prepared.value, input);
        registry.refresh(heartbeatOwnerQuery({ environmentId, input: {} }));
        return result;
      }),
  });

  const prepareHeartbeatOwnerTransfer = createEnvironmentCommand(runtime, {
    label: "environment-data:commands:portfolio:prepare-heartbeat-owner-transfer",
    scheduler: claimScheduler,
    concurrency: {
      mode: "singleFlight" as const,
      key: ({ environmentId }: { readonly environmentId: EnvironmentId }) => String(environmentId),
    },
    execute: (input: PortfolioHeartbeatOwnerTransferPrepareRequest, registry, environmentId) =>
      Effect.gen(function* () {
        const supervisor = yield* EnvironmentSupervisor;
        const loader = yield* PortfolioHeartbeatOwnerLoader;
        const prepared = yield* SubscriptionRef.get(supervisor.prepared);
        if (Option.isNone(prepared)) {
          return yield* new PortfolioHeartbeatOwnerConnectionNotReadyError({
            message: "The native environment connection is not ready.",
          });
        }
        const result = yield* loader.prepareTransfer(prepared.value, input);
        registry.refresh(heartbeatOwnerQuery({ environmentId, input: {} }));
        return result;
      }),
  });

  const acceptHeartbeatOwnerTransfer = createEnvironmentCommand(runtime, {
    label: "environment-data:commands:portfolio:accept-heartbeat-owner-transfer",
    scheduler: claimScheduler,
    concurrency: {
      mode: "singleFlight" as const,
      key: ({ environmentId }: { readonly environmentId: EnvironmentId }) => String(environmentId),
    },
    execute: (input: PortfolioHeartbeatOwnerTransferTicket, registry, environmentId) =>
      Effect.gen(function* () {
        const supervisor = yield* EnvironmentSupervisor;
        const loader = yield* PortfolioHeartbeatOwnerLoader;
        const prepared = yield* SubscriptionRef.get(supervisor.prepared);
        if (Option.isNone(prepared)) {
          return yield* new PortfolioHeartbeatOwnerConnectionNotReadyError({
            message: "The native environment connection is not ready.",
          });
        }
        const result = yield* loader.acceptTransfer(prepared.value, input);
        registry.refresh(heartbeatOwnerQuery({ environmentId, input: {} }));
        return result;
      }),
  });

  const finalizeHeartbeatOwnerTransfer = createEnvironmentCommand(runtime, {
    label: "environment-data:commands:portfolio:finalize-heartbeat-owner-transfer",
    scheduler: claimScheduler,
    concurrency: {
      mode: "singleFlight" as const,
      key: ({ environmentId }: { readonly environmentId: EnvironmentId }) => String(environmentId),
    },
    execute: (input: PortfolioHeartbeatOwnerTransferTicket, registry, environmentId) =>
      Effect.gen(function* () {
        const supervisor = yield* EnvironmentSupervisor;
        const loader = yield* PortfolioHeartbeatOwnerLoader;
        const prepared = yield* SubscriptionRef.get(supervisor.prepared);
        if (Option.isNone(prepared)) {
          return yield* new PortfolioHeartbeatOwnerConnectionNotReadyError({
            message: "The native environment connection is not ready.",
          });
        }
        const result = yield* loader.finalizeTransfer(prepared.value, input);
        registry.refresh(heartbeatOwnerQuery({ environmentId, input: {} }));
        return result;
      }),
  });

  const createTask = createEnvironmentCommand(runtime, {
    label: "environment-data:commands:portfolio:create-task",
    scheduler: claimScheduler,
    concurrency: {
      mode: "singleFlight" as const,
      key: ({ environmentId }: { readonly environmentId: EnvironmentId }) => String(environmentId),
    },
    execute: (input: PortfolioTaskCreateRequest, registry, environmentId) =>
      Effect.gen(function* () {
        const supervisor = yield* EnvironmentSupervisor;
        const loader = yield* PortfolioHeartbeatOwnerLoader;
        const prepared = yield* SubscriptionRef.get(supervisor.prepared);
        if (Option.isNone(prepared)) {
          return yield* new PortfolioHeartbeatOwnerConnectionNotReadyError({
            message: "The native environment connection is not ready.",
          });
        }
        const result = yield* loader.createTask(prepared.value, input);
        registry.refresh(tasksQuery({ environmentId, input: {} }));
        return result;
      }),
  });

  const transitionTaskStatus = createEnvironmentCommand(runtime, {
    label: "environment-data:commands:portfolio:transition-task-status",
    scheduler: claimScheduler,
    concurrency: {
      mode: "singleFlight" as const,
      key: ({ environmentId }: { readonly environmentId: EnvironmentId }) => String(environmentId),
    },
    execute: (input: PortfolioTaskStatusTransitionRequest, registry, environmentId) =>
      Effect.gen(function* () {
        const supervisor = yield* EnvironmentSupervisor;
        const loader = yield* PortfolioHeartbeatOwnerLoader;
        const prepared = yield* SubscriptionRef.get(supervisor.prepared);
        if (Option.isNone(prepared)) {
          return yield* new PortfolioHeartbeatOwnerConnectionNotReadyError({
            message: "The native environment connection is not ready.",
          });
        }
        const result = yield* loader.transitionTaskStatus(prepared.value, input);
        registry.refresh(tasksQuery({ environmentId, input: {} }));
        return result;
      }),
  });

  const recordTaskReceipt = createEnvironmentCommand(runtime, {
    label: "environment-data:commands:portfolio:record-task-receipt",
    scheduler: claimScheduler,
    concurrency: {
      mode: "singleFlight" as const,
      key: ({ environmentId }: { readonly environmentId: EnvironmentId }) => String(environmentId),
    },
    execute: (input: PortfolioTaskReceiptRecordRequest, registry, environmentId) =>
      Effect.gen(function* () {
        const supervisor = yield* EnvironmentSupervisor;
        const loader = yield* PortfolioHeartbeatOwnerLoader;
        const prepared = yield* SubscriptionRef.get(supervisor.prepared);
        if (Option.isNone(prepared)) {
          return yield* new PortfolioHeartbeatOwnerConnectionNotReadyError({
            message: "The native environment connection is not ready.",
          });
        }
        const result = yield* loader.recordTaskReceipt(prepared.value, input);
        registry.refresh(tasksQuery({ environmentId, input: {} }));
        return result;
      }),
  });

  const createWishlist = createEnvironmentCommand(runtime, {
    label: "environment-data:commands:portfolio:create-wishlist",
    scheduler: claimScheduler,
    concurrency: {
      mode: "singleFlight" as const,
      key: ({ environmentId }: { readonly environmentId: EnvironmentId }) => String(environmentId),
    },
    execute: (input: PortfolioWishlistCreateRequest, registry, environmentId) =>
      Effect.gen(function* () {
        const supervisor = yield* EnvironmentSupervisor;
        const loader = yield* PortfolioHeartbeatOwnerLoader;
        const prepared = yield* SubscriptionRef.get(supervisor.prepared);
        if (Option.isNone(prepared))
          return yield* new PortfolioHeartbeatOwnerConnectionNotReadyError({
            message: "The native environment connection is not ready.",
          });
        const result = yield* loader.createWishlist(prepared.value, input);
        registry.refresh(wishlistsQuery({ environmentId, input: {} }));
        return result;
      }),
  });

  const promoteWishlist = createEnvironmentCommand(runtime, {
    label: "environment-data:commands:portfolio:promote-wishlist",
    scheduler: claimScheduler,
    concurrency: {
      mode: "singleFlight" as const,
      key: ({ environmentId }: { readonly environmentId: EnvironmentId }) => String(environmentId),
    },
    execute: (input: PortfolioWishlistPromotionRequest, registry, environmentId) =>
      Effect.gen(function* () {
        const supervisor = yield* EnvironmentSupervisor;
        const loader = yield* PortfolioHeartbeatOwnerLoader;
        const prepared = yield* SubscriptionRef.get(supervisor.prepared);
        if (Option.isNone(prepared))
          return yield* new PortfolioHeartbeatOwnerConnectionNotReadyError({
            message: "The native environment connection is not ready.",
          });
        const result = yield* loader.promoteWishlist(prepared.value, input);
        registry.refresh(wishlistsQuery({ environmentId, input: {} }));
        return result;
      }),
  });

  const upsertHeartbeatRecord = createEnvironmentCommand(runtime, {
    label: "environment-data:commands:portfolio:upsert-heartbeat-record",
    scheduler: claimScheduler,
    concurrency: {
      mode: "singleFlight" as const,
      key: ({ environmentId }: { readonly environmentId: EnvironmentId }) => String(environmentId),
    },
    execute: (input: PortfolioHeartbeatRecordUpsertRequest, registry, environmentId) =>
      Effect.gen(function* () {
        const supervisor = yield* EnvironmentSupervisor;
        const loader = yield* PortfolioHeartbeatOwnerLoader;
        const prepared = yield* SubscriptionRef.get(supervisor.prepared);
        if (Option.isNone(prepared))
          return yield* new PortfolioHeartbeatOwnerConnectionNotReadyError({
            message: "The native environment connection is not ready.",
          });
        const result = yield* loader.upsertHeartbeatRecord(prepared.value, input);
        registry.refresh(heartbeatRecordsQuery({ environmentId, input: {} }));
        return result;
      }),
  });

  const dispatchDueHeartbeat = createEnvironmentCommand(runtime, {
    label: "environment-data:commands:portfolio:dispatch-due-heartbeat",
    scheduler: claimScheduler,
    concurrency: {
      mode: "singleFlight" as const,
      key: ({
        environmentId,
        input,
      }: {
        readonly environmentId: EnvironmentId;
        readonly input: PortfolioHeartbeatRecord;
      }) => `${environmentId}:${input.heartbeatId}`,
    },
    execute: (input: PortfolioHeartbeatRecord, registry, ownerEnvironmentId) =>
      Effect.gen(function* () {
        const now = yield* DateTime.now;
        const nowIso = DateTime.formatIso(now);
        if (!isPortfolioHeartbeatDue(input, nowIso))
          return { accepted: false, reason: "not-due" } as const;
        const supervisor = yield* EnvironmentSupervisor;
        const loader = yield* PortfolioHeartbeatOwnerLoader;
        const prepared = yield* SubscriptionRef.get(supervisor.prepared);
        if (Option.isNone(prepared))
          return yield* new PortfolioHeartbeatOwnerConnectionNotReadyError({
            message: "The native environment connection is not ready.",
          });
        const tasksRead = yield* loader.tasks(prepared.value);
        const task =
          input.taskId === undefined || input.taskId === null
            ? null
            : (tasksRead.tasks.find(
                (candidate) => String(candidate.taskId) === String(input.taskId),
              ) ?? null);
        const commandId = CommandId.make(
          `heartbeat-${input.heartbeatId}-run-${input.runCount + 1}`,
        );
        const messageId = MessageId.make(`${commandId}-message`);
        const turn = buildPortfolioHeartbeatRemoteTurn({
          ownerEnvironmentId,
          record: input,
          task,
          commandId,
          messageId,
          createdAt: nowIso,
        });
        const result = yield* Effect.promise(() =>
          threadEnvironment.startTurn.run(registry, {
            environmentId: turn.target.environmentId,
            input: {
              commandId: turn.commandId,
              threadId: turn.target.threadId,
              message: {
                messageId: turn.messageId,
                role: "user",
                text: turn.message,
                attachments: [],
              },
              runtimeMode: "full-access",
              interactionMode: "default",
              createdAt: turn.createdAt,
            },
          }),
        );
        const accepted = result._tag === "Success";
        const sequence = accepted ? result.value.sequence : undefined;
        const detail =
          result._tag === "Success"
            ? `Remote native Heartbeat accepted by target environment (sequence ${sequence}).`
            : formatPortfolioHeartbeatRemoteFailure(squashAtomCommandFailure(result));
        const receipt = {
          commandId,
          target: input.target,
          status: accepted ? ("dispatched" as const) : ("failed" as const),
          ...(sequence === undefined ? {} : { sequence }),
          observedAt: nowIso,
          detail,
        };
        const runCount = accepted ? input.runCount + 1 : input.runCount;
        const exhausted =
          input.maxRuns !== null && input.maxRuns !== undefined && runCount >= input.maxRuns;
        yield* loader.upsertHeartbeatRecord(prepared.value, {
          ...input,
          status: accepted ? (exhausted ? "exhausted" : "paused") : "blocked",
          runCount,
          nextRunAt:
            accepted && !exhausted && input.cadenceMinutes !== null
              ? DateTime.formatIso(DateTime.add(now, { minutes: input.cadenceMinutes }))
              : null,
          lastReceipt: receipt,
          stopReason: accepted ? input.stopReason : receipt.detail,
          updatedAt: nowIso,
        });
        registry.refresh(heartbeatRecordsQuery({ environmentId: ownerEnvironmentId, input: {} }));
        return { accepted, receipt } as const;
      }),
  });

  return {
    heartbeatOwner: (environmentId: EnvironmentId) =>
      heartbeatOwnerQuery({ environmentId, input: {} }),
    tasks: (environmentId: EnvironmentId) => tasksQuery({ environmentId, input: {} }),
    wishlists: (environmentId: EnvironmentId) => wishlistsQuery({ environmentId, input: {} }),
    heartbeatRecords: (environmentId: EnvironmentId) =>
      heartbeatRecordsQuery({ environmentId, input: {} }),
    createTask,
    createWishlist,
    promoteWishlist,
    upsertHeartbeatRecord,
    dispatchDueHeartbeat,
    transitionTaskStatus,
    recordTaskReceipt,
    claimHeartbeatOwner,
    recordHeartbeatReceipt,
    prepareHeartbeatOwnerTransfer,
    acceptHeartbeatOwnerTransfer,
    finalizeHeartbeatOwnerTransfer,
  };
}
