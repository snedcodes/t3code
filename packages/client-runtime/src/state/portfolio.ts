import type {
  EnvironmentId,
  PortfolioHeartbeatOwnerClaimRequest,
  PortfolioHeartbeatOwnerTransferPrepareRequest,
  PortfolioHeartbeatOwnerTransferTicket,
  PortfolioHeartbeatReceiptRecordRequest,
} from "@t3tools/contracts";
import * as Data from "effect/Data";
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
} from "./runtime.ts";
import { PortfolioHeartbeatOwnerLoader } from "./portfolioHeartbeatOwnerHttp.ts";

export class PortfolioHeartbeatOwnerConnectionNotReadyError extends Data.TaggedError(
  "PortfolioHeartbeatOwnerConnectionNotReadyError",
)<{
  readonly message: string;
}> {}

export function createPortfolioEnvironmentAtoms<R, E>(
  runtime: Atom.AtomRuntime<EnvironmentRegistry | PortfolioHeartbeatOwnerLoader | R, E>,
) {
  const claimScheduler = createAtomCommandScheduler();
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

  return {
    heartbeatOwner: (environmentId: EnvironmentId) =>
      heartbeatOwnerQuery({ environmentId, input: {} }),
    claimHeartbeatOwner,
    recordHeartbeatReceipt,
    prepareHeartbeatOwnerTransfer,
    acceptHeartbeatOwnerTransfer,
    finalizeHeartbeatOwnerTransfer,
  };
}
