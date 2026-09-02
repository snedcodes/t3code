import {
  EnvironmentId,
  PortfolioHeartbeatOwnerDescriptor,
  PortfolioHeartbeatOwnerTransferPrepareRequest,
  PortfolioHeartbeatOwnerTransferTicket,
  PortfolioHeartbeatRecord,
  PortfolioHeartbeatRecordReadback,
  PortfolioHeartbeatRecordUpsertRequest,
  PortfolioHeartbeatRecordsReadback,
  PortfolioHeartbeatReceipt,
  type PortfolioTarget,
  type PortfolioHeartbeatOwnerReadback as PortfolioHeartbeatOwnerReadbackValue,
} from "@t3tools/contracts";
import * as Context from "effect/Context";
import * as Crypto from "effect/Crypto";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";
import * as Semaphore from "effect/Semaphore";

import { writeFileStringAtomically } from "../atomicWrite.ts";
import * as ServerConfig from "../config.ts";
import * as ServerEnvironment from "../environment/ServerEnvironment.ts";
import {
  decidePortfolioHeartbeatOwnerClaim,
  type PortfolioHeartbeatOwnerClaimDecision,
  type PortfolioHeartbeatOwnerClaimInput,
} from "./PortfolioHeartbeatOwnerClaim.ts";

const OWNER_DESCRIPTOR_FILE = "portfolio-heartbeat-owner.json";
const OWNER_TRANSFER_FILE = "portfolio-heartbeat-owner-transfer.json";
const HEARTBEAT_RECORDS_FILE = "portfolio-heartbeat-records.json";
export const OWNER_STALE_AFTER_MS = 2 * 60 * 1_000;

const decodeDescriptor = Schema.decodeUnknownEffect(
  Schema.fromJsonString(PortfolioHeartbeatOwnerDescriptor),
);
const encodeDescriptor = Schema.encodeEffect(
  Schema.fromJsonString(PortfolioHeartbeatOwnerDescriptor),
);
const decodeTransferTicket = Schema.decodeUnknownEffect(
  Schema.fromJsonString(PortfolioHeartbeatOwnerTransferTicket),
);
const encodeTransferTicket = Schema.encodeEffect(
  Schema.fromJsonString(PortfolioHeartbeatOwnerTransferTicket),
);
const decodeStoredHeartbeatRecords = Schema.decodeUnknownEffect(
  Schema.fromJsonString(Schema.Array(Schema.Unknown)),
);
const decodeHeartbeatRecords = (raw: string) =>
  decodeStoredHeartbeatRecords(raw).pipe(
    Effect.flatMap((records) =>
      Schema.decodeUnknownEffect(Schema.Array(PortfolioHeartbeatRecord))(
        records.map(normalizeStoredHeartbeatRecord),
      ),
    ),
  );
const encodeHeartbeatRecords = Schema.encodeEffect(
  Schema.fromJsonString(Schema.Array(PortfolioHeartbeatRecord)),
);

export function normalizeStoredHeartbeatRecord(value: unknown): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return value;
  const record = value as Record<string, unknown>;
  if (typeof record.enabled === "boolean") return record;

  const wasScheduled =
    record.status === "active" || (record.status === "paused" && record.nextRunAt != null);
  const oldReason =
    typeof record.stopReason === "string"
      ? record.stopReason
      : typeof record.pauseReason === "string"
        ? record.pauseReason
        : typeof record.status === "string" && !wasScheduled
          ? `Legacy Heartbeat was ${record.status}.`
          : null;
  const { status: _status, pauseReason: _pauseReason, stopReason: _stopReason, ...rest } = record;
  return {
    ...rest,
    enabled: wasScheduled,
    activeRunId: null,
    disabledReason: wasScheduled ? null : oldReason,
    nextRunAt: wasScheduled ? (record.nextRunAt ?? null) : null,
  };
}

export class PortfolioHeartbeatOwnerPersistenceError extends Schema.TaggedErrorClass<PortfolioHeartbeatOwnerPersistenceError>()(
  "PortfolioHeartbeatOwnerPersistenceError",
  {
    operation: Schema.Literal("write"),
    ownerPath: Schema.String,
    cause: Schema.Defect(),
  },
) {}

type PortfolioHeartbeatOwnerClaimRequest = Omit<PortfolioHeartbeatOwnerClaimInput, "current">;

export type PortfolioHeartbeatOwnerReceiptInput = {
  readonly ownerEnvironmentId: EnvironmentId;
  readonly receipt: PortfolioHeartbeatReceipt;
  readonly updatedAt: string;
};

export type PortfolioHeartbeatOwnerReceiptReason =
  | "accepted"
  | "already-recorded"
  | "no-owner"
  | "different-owner"
  | "target-mismatch"
  | "older-receipt";

export type PortfolioHeartbeatOwnerReceiptDecision = {
  readonly accepted: boolean;
  readonly reason: PortfolioHeartbeatOwnerReceiptReason;
};

export type PortfolioHeartbeatRecordUpsertDecision = {
  readonly accepted: boolean;
  readonly reason:
    | "accepted"
    | "already-recorded"
    | "no-owner"
    | "different-owner"
    | "target-mismatch";
};

export type PortfolioHeartbeatOwnerTransferDecision = {
  readonly accepted: boolean;
  readonly reason:
    | "accepted"
    | "already-prepared"
    | "already-accepted"
    | "already-finalized"
    | "no-owner"
    | "different-owner"
    | "target-mismatch"
    | "duplicate-owner"
    | "heartbeats-not-paused"
    | "epoch-not-monotonic"
    | "pending-transfer"
    | "ticket-mismatch"
    | "target-owner-conflict";
};

export type PortfolioHeartbeatOwnerTransferPrepareInput =
  PortfolioHeartbeatOwnerTransferPrepareRequest & {
    readonly sourceOwnerEnvironmentId: EnvironmentId;
    readonly preparedAt: string;
  };

export type PortfolioHeartbeatOwnerTransferPrepareDecision = {
  readonly accepted: boolean;
  readonly reason:
    | "accepted"
    | "already-prepared"
    | "no-owner"
    | "different-owner"
    | "target-mismatch"
    | "duplicate-owner"
    | "heartbeats-not-paused"
    | "epoch-not-monotonic"
    | "pending-transfer";
  readonly ticket: PortfolioHeartbeatOwnerTransferTicket | null;
};

const unavailable = (): PortfolioHeartbeatOwnerReadbackValue => ({
  role: "owner_unavailable",
  freshness: "unknown",
  descriptor: null,
});

function freshnessFor(updatedAt: string, now: number): "fresh" | "stale" | "unknown" {
  const updatedAtMs = Date.parse(updatedAt);
  if (!Number.isFinite(updatedAtMs)) return "unknown";
  return now - updatedAtMs <= OWNER_STALE_AFTER_MS ? "fresh" : "stale";
}

function sameTarget(left: PortfolioTarget | null, right: PortfolioTarget): boolean {
  return (
    left !== null &&
    left.environmentId === right.environmentId &&
    left.projectId === right.projectId &&
    left.threadId === right.threadId
  );
}

function sameReceipt(left: PortfolioHeartbeatReceipt, right: PortfolioHeartbeatReceipt): boolean {
  return (
    left.commandId === right.commandId &&
    left.target.environmentId === right.target.environmentId &&
    left.target.projectId === right.target.projectId &&
    left.target.threadId === right.target.threadId &&
    left.status === right.status &&
    left.sequence === right.sequence &&
    left.observedAt === right.observedAt
  );
}

function sameDescriptorContinuity(
  descriptor: PortfolioHeartbeatOwnerReadbackValue["descriptor"],
  ticket: PortfolioHeartbeatOwnerTransferTicket,
): boolean {
  return (
    descriptor !== null &&
    descriptor.ownerEnvironmentId === ticket.sourceOwnerEnvironmentId &&
    descriptor.ownerEpoch < ticket.ownerEpoch &&
    descriptor.portfolioRevision === ticket.portfolioRevision &&
    descriptor.heartbeatRevision === ticket.heartbeatRevision &&
    descriptor.portfolioChecksum === ticket.portfolioChecksum &&
    descriptor.heartbeatChecksum === ticket.heartbeatChecksum &&
    sameTarget(descriptor.target, ticket.target) &&
    (descriptor.lastReceipt === null || ticket.lastReceipt === null
      ? descriptor.lastReceipt === ticket.lastReceipt
      : sameReceipt(descriptor.lastReceipt, ticket.lastReceipt))
  );
}

function sameTicket(
  left: PortfolioHeartbeatOwnerTransferTicket,
  right: PortfolioHeartbeatOwnerTransferTicket,
): boolean {
  return (
    left.transferId === right.transferId &&
    left.sourceOwnerEnvironmentId === right.sourceOwnerEnvironmentId &&
    left.targetOwnerEnvironmentId === right.targetOwnerEnvironmentId &&
    left.ownerEpoch === right.ownerEpoch &&
    left.portfolioRevision === right.portfolioRevision &&
    left.heartbeatRevision === right.heartbeatRevision &&
    left.portfolioChecksum === right.portfolioChecksum &&
    left.heartbeatChecksum === right.heartbeatChecksum &&
    sameTarget(left.target, right.target) &&
    left.preparedAt === right.preparedAt &&
    left.heartbeatsPaused === right.heartbeatsPaused &&
    (left.lastReceipt === null || right.lastReceipt === null
      ? left.lastReceipt === right.lastReceipt
      : sameReceipt(left.lastReceipt, right.lastReceipt))
  );
}

function descriptorFromTicket(
  ticket: PortfolioHeartbeatOwnerTransferTicket,
  updatedAt: string,
): NonNullable<PortfolioHeartbeatOwnerReadbackValue["descriptor"]> {
  return {
    schemaVersion: "1",
    domain: "portfolio_heartbeat",
    ownerEnvironmentId: ticket.targetOwnerEnvironmentId,
    ownerEpoch: ticket.ownerEpoch,
    portfolioRevision: ticket.portfolioRevision,
    heartbeatRevision: ticket.heartbeatRevision,
    portfolioChecksum: ticket.portfolioChecksum,
    heartbeatChecksum: ticket.heartbeatChecksum,
    updatedAt,
    target: ticket.target,
    lastReceipt: ticket.lastReceipt,
  };
}

export class PortfolioHeartbeatOwner extends Context.Service<
  PortfolioHeartbeatOwner,
  {
    readonly read: Effect.Effect<PortfolioHeartbeatOwnerReadbackValue>;
    readonly claim: (
      input: PortfolioHeartbeatOwnerClaimRequest,
    ) => Effect.Effect<
      PortfolioHeartbeatOwnerClaimDecision,
      PortfolioHeartbeatOwnerPersistenceError
    >;
    readonly recordReceipt: (
      input: PortfolioHeartbeatOwnerReceiptInput,
    ) => Effect.Effect<
      PortfolioHeartbeatOwnerReceiptDecision,
      PortfolioHeartbeatOwnerPersistenceError
    >;
    readonly readRecords: Effect.Effect<PortfolioHeartbeatRecordsReadback>;
    readonly readRecord: (heartbeatId: string) => Effect.Effect<PortfolioHeartbeatRecordReadback>;
    readonly upsertRecord: (input: {
      readonly ownerEnvironmentId: EnvironmentId;
      readonly record: PortfolioHeartbeatRecordUpsertRequest;
    }) => Effect.Effect<
      PortfolioHeartbeatRecordUpsertDecision,
      PortfolioHeartbeatOwnerPersistenceError
    >;
    readonly prepareTransfer: (
      input: PortfolioHeartbeatOwnerTransferPrepareInput,
    ) => Effect.Effect<
      PortfolioHeartbeatOwnerTransferPrepareDecision,
      PortfolioHeartbeatOwnerPersistenceError
    >;
    readonly acceptTransfer: (input: {
      readonly ticket: PortfolioHeartbeatOwnerTransferTicket;
      readonly updatedAt: string;
    }) => Effect.Effect<
      PortfolioHeartbeatOwnerTransferDecision,
      PortfolioHeartbeatOwnerPersistenceError
    >;
    readonly finalizeTransfer: (input: {
      readonly ticket: PortfolioHeartbeatOwnerTransferTicket;
      readonly updatedAt: string;
    }) => Effect.Effect<
      PortfolioHeartbeatOwnerTransferDecision,
      PortfolioHeartbeatOwnerPersistenceError
    >;
  }
>()("t3/portfolio/PortfolioHeartbeatOwner") {}

export const make = Effect.gen(function* () {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const config = yield* ServerConfig.ServerConfig;
  const environment = yield* ServerEnvironment.ServerEnvironment;
  const crypto = yield* Crypto.Crypto;
  const ownerPath = path.join(config.stateDir, OWNER_DESCRIPTOR_FILE);
  const transferPath = path.join(config.stateDir, OWNER_TRANSFER_FILE);
  const recordsPath = path.join(config.stateDir, HEARTBEAT_RECORDS_FILE);
  const claimMutex = yield* Semaphore.make(1);

  const readDescriptor: Effect.Effect<PortfolioHeartbeatOwnerReadbackValue["descriptor"]> =
    fileSystem.readFileString(ownerPath).pipe(
      Effect.flatMap((raw) => decodeDescriptor(raw)),
      Effect.orElseSucceed(() => null),
    );

  const readTransferTicket: Effect.Effect<PortfolioHeartbeatOwnerTransferTicket | null> = fileSystem
    .readFileString(transferPath)
    .pipe(
      Effect.flatMap((raw) => decodeTransferTicket(raw)),
      Effect.orElseSucceed(() => null),
    );

  const readHeartbeatRecords: Effect.Effect<ReadonlyArray<PortfolioHeartbeatRecord>> = fileSystem
    .readFileString(recordsPath)
    .pipe(
      Effect.flatMap((raw) => decodeHeartbeatRecords(raw)),
      Effect.orElseSucceed(() => []),
    );

  const read: PortfolioHeartbeatOwner["Service"]["read"] = Effect.gen(function* () {
    const descriptor = yield* readDescriptor;
    if (descriptor === null) return unavailable();

    const environmentId = yield* environment.getEnvironmentId;
    const now = yield* DateTime.now;
    return {
      role: descriptor.ownerEnvironmentId === environmentId ? "owner" : "non_owner",
      freshness: freshnessFor(descriptor.updatedAt, now.epochMilliseconds),
      descriptor,
    } satisfies PortfolioHeartbeatOwnerReadbackValue;
  }).pipe(
    Effect.tapError((cause) =>
      Effect.logWarning("Portfolio Heartbeat owner readback failed", {
        ownerPath,
        cause,
      }),
    ),
    Effect.orElseSucceed(unavailable),
  );

  const readRecords: PortfolioHeartbeatOwner["Service"]["readRecords"] = Effect.gen(function* () {
    const ownerReadback = yield* read;
    if (ownerReadback.role !== "owner") {
      return { owner: ownerReadback, records: [] } satisfies PortfolioHeartbeatRecordsReadback;
    }
    return {
      owner: ownerReadback,
      records: yield* readHeartbeatRecords,
    } satisfies PortfolioHeartbeatRecordsReadback;
  });

  const readRecord: PortfolioHeartbeatOwner["Service"]["readRecord"] = (heartbeatId) =>
    Effect.gen(function* () {
      const ownerReadback = yield* read;
      if (ownerReadback.role !== "owner") {
        return { owner: ownerReadback, record: null } satisfies PortfolioHeartbeatRecordReadback;
      }
      const record =
        (yield* readHeartbeatRecords).find((candidate) => candidate.heartbeatId === heartbeatId) ??
        null;
      return { owner: ownerReadback, record } satisfies PortfolioHeartbeatRecordReadback;
    });

  const upsertRecord: PortfolioHeartbeatOwner["Service"]["upsertRecord"] = (input) =>
    claimMutex
      .withPermits(1)(
        Effect.gen(function* () {
          const current = yield* readDescriptor;
          if (current === null) return { accepted: false, reason: "no-owner" } as const;
          const environmentId = yield* environment.getEnvironmentId;
          if (
            current.ownerEnvironmentId !== environmentId ||
            current.ownerEnvironmentId !== input.ownerEnvironmentId
          ) {
            return { accepted: false, reason: "different-owner" } as const;
          }

          const records = [...(yield* readHeartbeatRecords)];
          const index = records.findIndex(
            (record) => record.heartbeatId === input.record.heartbeatId,
          );
          if (index >= 0) {
            const existing = records[index];
            if (existing !== undefined) {
              const existingEncoded = yield* encodeHeartbeatRecords([existing]);
              const inputEncoded = yield* encodeHeartbeatRecords([input.record]);
              if (existingEncoded === inputEncoded) {
                return { accepted: true, reason: "already-recorded" } as const;
              }
            }
            records[index] = input.record;
          } else {
            records.push(input.record);
          }

          const encodedRecords = yield* encodeHeartbeatRecords(records);
          yield* writeFileStringAtomically({
            filePath: recordsPath,
            contents: `${encodedRecords}\n`,
          }).pipe(
            Effect.provideService(FileSystem.FileSystem, fileSystem),
            Effect.provideService(Path.Path, path),
          );
          return { accepted: true, reason: "accepted" } as const;
        }),
      )
      .pipe(
        Effect.mapError(
          (cause) =>
            new PortfolioHeartbeatOwnerPersistenceError({
              operation: "write",
              ownerPath: recordsPath,
              cause,
            }),
        ),
      );

  const claim: PortfolioHeartbeatOwner["Service"]["claim"] = (input) =>
    claimMutex
      .withPermits(1)(
        Effect.gen(function* () {
          const current = yield* readDescriptor;
          const decision = decidePortfolioHeartbeatOwnerClaim({ ...input, current });
          const descriptor =
            decision.accepted && decision.reason === "already-owner" && decision.descriptor !== null
              ? { ...decision.descriptor, updatedAt: input.updatedAt }
              : decision.descriptor;
          if (decision.accepted && descriptor !== null) {
            const encodedDescriptor = yield* encodeDescriptor(descriptor);
            yield* writeFileStringAtomically({
              filePath: ownerPath,
              contents: `${encodedDescriptor}\n`,
            }).pipe(
              Effect.provideService(FileSystem.FileSystem, fileSystem),
              Effect.provideService(Path.Path, path),
            );
          }
          return descriptor === decision.descriptor ? decision : { ...decision, descriptor };
        }),
      )
      .pipe(
        Effect.mapError(
          (cause) =>
            new PortfolioHeartbeatOwnerPersistenceError({
              operation: "write",
              ownerPath,
              cause,
            }),
        ),
      );

  const recordReceipt: PortfolioHeartbeatOwner["Service"]["recordReceipt"] = (input) =>
    claimMutex
      .withPermits(1)(
        Effect.gen(function* () {
          const current = yield* readDescriptor;
          if (current === null) {
            return { accepted: false, reason: "no-owner" } as const;
          }
          if (current.ownerEnvironmentId !== input.ownerEnvironmentId) {
            return { accepted: false, reason: "different-owner" } as const;
          }
          const isDescriptorTarget = sameTarget(current.target, input.receipt.target);
          const isHeartbeatTarget = (yield* readHeartbeatRecords).some((record) =>
            sameTarget(record.target, input.receipt.target),
          );
          if (!isDescriptorTarget && !isHeartbeatTarget) {
            return { accepted: false, reason: "target-mismatch" } as const;
          }

          if (current.lastReceipt && sameReceipt(current.lastReceipt, input.receipt)) {
            return { accepted: true, reason: "already-recorded" } as const;
          }

          const currentObservedAt = current.lastReceipt
            ? Date.parse(current.lastReceipt.observedAt)
            : Number.NEGATIVE_INFINITY;
          const incomingObservedAt = Date.parse(input.receipt.observedAt);
          if (
            Number.isFinite(currentObservedAt) &&
            Number.isFinite(incomingObservedAt) &&
            incomingObservedAt < currentObservedAt
          ) {
            return { accepted: false, reason: "older-receipt" } as const;
          }

          const encodedDescriptor = yield* encodeDescriptor({
            ...current,
            updatedAt: input.updatedAt,
            lastReceipt: input.receipt,
          });
          yield* writeFileStringAtomically({
            filePath: ownerPath,
            contents: `${encodedDescriptor}\n`,
          }).pipe(
            Effect.provideService(FileSystem.FileSystem, fileSystem),
            Effect.provideService(Path.Path, path),
          );
          return { accepted: true, reason: "accepted" } as const;
        }),
      )
      .pipe(
        Effect.mapError(
          (cause) =>
            new PortfolioHeartbeatOwnerPersistenceError({
              operation: "write",
              ownerPath,
              cause,
            }),
        ),
      );

  const prepareTransfer: PortfolioHeartbeatOwner["Service"]["prepareTransfer"] = (input) =>
    claimMutex
      .withPermits(1)(
        Effect.gen(function* () {
          const current = yield* readDescriptor;
          const environmentId = yield* environment.getEnvironmentId;
          if (input.sourceOwnerEnvironmentId !== environmentId) {
            return {
              accepted: false,
              reason: "different-owner",
              ticket: null,
            } as const;
          }
          if (current === null) {
            return { accepted: false, reason: "no-owner", ticket: null } as const;
          }
          if (current.ownerEnvironmentId !== environmentId) {
            return { accepted: false, reason: "different-owner", ticket: null } as const;
          }
          if (!input.heartbeatsPaused) {
            return { accepted: false, reason: "heartbeats-not-paused", ticket: null } as const;
          }
          if (input.targetOwnerEnvironmentId === environmentId) {
            return { accepted: false, reason: "duplicate-owner", ticket: null } as const;
          }
          if (current.target === null) {
            return { accepted: false, reason: "target-mismatch", ticket: null } as const;
          }
          if (input.proposedOwnerEpoch <= current.ownerEpoch) {
            return { accepted: false, reason: "epoch-not-monotonic", ticket: null } as const;
          }

          const pending = yield* readTransferTicket;
          if (pending !== null) {
            if (
              pending.sourceOwnerEnvironmentId === environmentId &&
              pending.targetOwnerEnvironmentId === input.targetOwnerEnvironmentId &&
              pending.ownerEpoch === input.proposedOwnerEpoch &&
              pending.portfolioRevision === current.portfolioRevision &&
              pending.heartbeatRevision === current.heartbeatRevision &&
              pending.portfolioChecksum === current.portfolioChecksum &&
              pending.heartbeatChecksum === current.heartbeatChecksum &&
              sameTarget(pending.target, current.target) &&
              (pending.lastReceipt === null || current.lastReceipt === null
                ? pending.lastReceipt === current.lastReceipt
                : sameReceipt(pending.lastReceipt, current.lastReceipt))
            ) {
              return { accepted: true, reason: "already-prepared", ticket: pending } as const;
            }
            return { accepted: false, reason: "pending-transfer", ticket: null } as const;
          }

          const ticket: PortfolioHeartbeatOwnerTransferTicket = {
            transferId: yield* crypto.randomUUIDv4,
            sourceOwnerEnvironmentId: environmentId,
            targetOwnerEnvironmentId: input.targetOwnerEnvironmentId,
            ownerEpoch: input.proposedOwnerEpoch,
            portfolioRevision: current.portfolioRevision,
            heartbeatRevision: current.heartbeatRevision,
            portfolioChecksum: current.portfolioChecksum,
            heartbeatChecksum: current.heartbeatChecksum,
            target: current.target,
            lastReceipt: current.lastReceipt,
            preparedAt: input.preparedAt,
            heartbeatsPaused: true,
          };
          const encodedTicket = yield* encodeTransferTicket(ticket);
          yield* writeFileStringAtomically({
            filePath: transferPath,
            contents: `${encodedTicket}\n`,
          }).pipe(
            Effect.provideService(FileSystem.FileSystem, fileSystem),
            Effect.provideService(Path.Path, path),
          );
          return { accepted: true, reason: "accepted", ticket } as const;
        }),
      )
      .pipe(
        Effect.mapError(
          (cause) =>
            new PortfolioHeartbeatOwnerPersistenceError({
              operation: "write",
              ownerPath: transferPath,
              cause,
            }),
        ),
      );

  const acceptTransfer: PortfolioHeartbeatOwner["Service"]["acceptTransfer"] = (input) =>
    claimMutex
      .withPermits(1)(
        Effect.gen(function* () {
          const environmentId = yield* environment.getEnvironmentId;
          const ticket = input.ticket;
          if (ticket.targetOwnerEnvironmentId !== environmentId) {
            return { accepted: false, reason: "target-mismatch" } as const;
          }
          if (!ticket.heartbeatsPaused) {
            return { accepted: false, reason: "heartbeats-not-paused" } as const;
          }
          if (ticket.sourceOwnerEnvironmentId === environmentId) {
            return { accepted: false, reason: "duplicate-owner" } as const;
          }

          const current = yield* readDescriptor;
          if (current !== null) {
            if (
              current.ownerEnvironmentId === environmentId &&
              current.ownerEpoch === ticket.ownerEpoch &&
              current.portfolioRevision === ticket.portfolioRevision &&
              current.heartbeatRevision === ticket.heartbeatRevision &&
              current.portfolioChecksum === ticket.portfolioChecksum &&
              current.heartbeatChecksum === ticket.heartbeatChecksum &&
              sameTarget(current.target, ticket.target) &&
              (current.lastReceipt === null || ticket.lastReceipt === null
                ? current.lastReceipt === ticket.lastReceipt
                : sameReceipt(current.lastReceipt, ticket.lastReceipt))
            ) {
              return { accepted: true, reason: "already-accepted" } as const;
            }
            return { accepted: false, reason: "target-owner-conflict" } as const;
          }

          const descriptor = descriptorFromTicket(ticket, input.updatedAt);
          const encodedDescriptor = yield* encodeDescriptor(descriptor);
          yield* writeFileStringAtomically({
            filePath: ownerPath,
            contents: `${encodedDescriptor}\n`,
          }).pipe(
            Effect.provideService(FileSystem.FileSystem, fileSystem),
            Effect.provideService(Path.Path, path),
          );
          return { accepted: true, reason: "accepted" } as const;
        }),
      )
      .pipe(
        Effect.mapError(
          (cause) =>
            new PortfolioHeartbeatOwnerPersistenceError({
              operation: "write",
              ownerPath,
              cause,
            }),
        ),
      );

  const finalizeTransfer: PortfolioHeartbeatOwner["Service"]["finalizeTransfer"] = (input) =>
    claimMutex
      .withPermits(1)(
        Effect.gen(function* () {
          const environmentId = yield* environment.getEnvironmentId;
          const ticket = input.ticket;
          if (ticket.sourceOwnerEnvironmentId !== environmentId) {
            return { accepted: false, reason: "different-owner" } as const;
          }
          if (!ticket.heartbeatsPaused) {
            return { accepted: false, reason: "heartbeats-not-paused" } as const;
          }

          const current = yield* readDescriptor;
          if (current === null) {
            return { accepted: false, reason: "no-owner" } as const;
          }
          if (current.ownerEnvironmentId === ticket.targetOwnerEnvironmentId) {
            return { accepted: true, reason: "already-finalized" } as const;
          }
          if (current.ownerEnvironmentId !== environmentId) {
            return { accepted: false, reason: "different-owner" } as const;
          }

          const pending = yield* readTransferTicket;
          if (pending === null || !sameTicket(pending, ticket)) {
            return { accepted: false, reason: "ticket-mismatch" } as const;
          }
          if (!sameDescriptorContinuity(current, ticket)) {
            return { accepted: false, reason: "ticket-mismatch" } as const;
          }

          const descriptor = descriptorFromTicket(ticket, input.updatedAt);
          const encodedDescriptor = yield* encodeDescriptor(descriptor);
          yield* writeFileStringAtomically({
            filePath: ownerPath,
            contents: `${encodedDescriptor}\n`,
          }).pipe(
            Effect.provideService(FileSystem.FileSystem, fileSystem),
            Effect.provideService(Path.Path, path),
          );
          yield* fileSystem.remove(transferPath, { force: true });
          return { accepted: true, reason: "accepted" } as const;
        }),
      )
      .pipe(
        Effect.mapError(
          (cause) =>
            new PortfolioHeartbeatOwnerPersistenceError({
              operation: "write",
              ownerPath,
              cause,
            }),
        ),
      );

  return PortfolioHeartbeatOwner.of({
    read,
    readRecords,
    readRecord,
    upsertRecord,
    claim,
    recordReceipt,
    prepareTransfer,
    acceptTransfer,
    finalizeTransfer,
  });
});

export const layer = Layer.effect(PortfolioHeartbeatOwner, make);
