import {
  CommandId,
  MessageId,
  type PortfolioHeartbeatRecord,
  type PortfolioHeartbeatReceipt,
  type PortfolioTask,
  type OrchestrationCommand,
} from "@t3tools/contracts";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import * as ServerEnvironment from "../environment/ServerEnvironment.ts";
import { OrchestrationEngineService } from "../orchestration/Services/OrchestrationEngine.ts";
import * as PortfolioHeartbeatOwner from "./PortfolioHeartbeatOwner.ts";
import * as PortfolioTaskOwner from "./PortfolioTaskOwner.ts";

const SCHEDULER_POLL = Duration.seconds(15);

export function isLocalHeartbeatTarget(
  record: PortfolioHeartbeatRecord,
  environmentId: string,
): boolean {
  return String(record.target.environmentId) === environmentId;
}

export function buildPortfolioHeartbeatPrompt(
  record: PortfolioHeartbeatRecord,
  task: PortfolioTask | null,
): string {
  const customMessage = record.message?.trim();
  if (customMessage) return customMessage;

  if (task === null) {
    return [
      `Run the standalone Heartbeat "${record.heartbeatId}" for its exact native target.`,
      "Complete one bounded check, record the outcome, and stop only this linked Heartbeat when its stop condition is met.",
    ].join("\n\n");
  }

  const incomplete = task.checklistItems
    .filter((item) => item.state !== "complete")
    .map((item) => `- [${item.state}] ${item.text}`)
    .join("\n");

  return [
    `Continue Task "${task.title}" (Task ID: ${task.taskId}).`,
    `Outcome: ${task.outcome}`,
    "Incomplete checklist:",
    incomplete || "- None; verify the completion condition.",
    `Completion condition: ${task.completionCondition}`,
    "Use the canonical Task path to update the Task with evidence and its receipt.",
    `When the completion condition is met, update Task ${task.taskId} to complete, then stop only its linked Heartbeat ${record.heartbeatId}. Do not stop any other Heartbeat.`,
  ].join("\n");
}

function nextRunAt(record: PortfolioHeartbeatRecord, now: DateTime.Utc): string | null {
  return record.cadenceMinutes === null || record.cadenceMinutes === undefined
    ? null
    : DateTime.formatIso(DateTime.add(now, { minutes: record.cadenceMinutes }));
}

function makeReceipt(input: {
  readonly record: PortfolioHeartbeatRecord;
  readonly commandId: string;
  readonly now: string;
  readonly status: PortfolioHeartbeatReceipt["status"];
  readonly sequence?: number;
  readonly detail: string;
}): PortfolioHeartbeatReceipt {
  return {
    commandId: CommandId.make(input.commandId),
    target: input.record.target,
    status: input.status,
    ...(input.sequence === undefined ? {} : { sequence: input.sequence }),
    observedAt: input.now,
    detail: input.detail,
  };
}

export class PortfolioHeartbeatScheduler extends Context.Service<
  PortfolioHeartbeatScheduler,
  { readonly started: true }
>()("t3/portfolio/PortfolioHeartbeatScheduler") {}

export const make = Effect.gen(function* () {
  const owner = yield* PortfolioHeartbeatOwner.PortfolioHeartbeatOwner;
  const tasks = yield* PortfolioTaskOwner.PortfolioTaskOwner;
  const environment = yield* ServerEnvironment.ServerEnvironment;
  const engine = yield* OrchestrationEngineService;

  const persist = (
    ownerEnvironmentId: Parameters<typeof owner.upsertRecord>[0]["ownerEnvironmentId"],
    record: PortfolioHeartbeatRecord,
  ) => owner.upsertRecord({ ownerEnvironmentId, record }).pipe(Effect.catch(() => Effect.void));

  const runOnce = Effect.gen(function* () {
    const ownerRead = yield* owner.read;
    if (ownerRead.role !== "owner") return;
    const environmentId = yield* environment.getEnvironmentId;
    const recordsRead = yield* owner.readRecords;
    const tasksRead = yield* tasks.read;
    const now = yield* DateTime.now;
    const nowIso = DateTime.formatIso(now);

    for (const record of recordsRead.records) {
      if (record.status !== "paused" || record.nextRunAt === undefined || record.nextRunAt === null)
        continue;
      if (Date.parse(record.nextRunAt) > now.epochMilliseconds) continue;

      if (record.expiresAt !== null && Date.parse(record.expiresAt) <= now.epochMilliseconds) {
        yield* persist(environmentId, { ...record, status: "expired", updatedAt: nowIso });
        continue;
      }
      if (record.maxRuns !== null && record.runCount >= record.maxRuns) {
        yield* persist(environmentId, { ...record, status: "exhausted", updatedAt: nowIso });
        continue;
      }

      const task =
        record.taskId === undefined || record.taskId === null
          ? null
          : (tasksRead.tasks.find(
              (candidate) => String(candidate.taskId) === String(record.taskId),
            ) ?? null);
      if (record.taskId !== undefined && record.taskId !== null && task === null) {
        yield* persist(environmentId, {
          ...record,
          status: "blocked",
          stopReason: `Linked Task ${record.taskId} was not found.`,
          updatedAt: nowIso,
        });
        continue;
      }

      if (!isLocalHeartbeatTarget(record, String(environmentId))) {
        // The mounted VPS client-runtime dispatcher owns remote delivery.
        // Leave the record paused and due so it can claim this exact target.
        continue;
      }

      const runNumber = record.runCount + 1;
      const commandId = `heartbeat-${record.heartbeatId}-run-${runNumber}`;
      const command: OrchestrationCommand = {
        type: "thread.turn.start" as const,
        commandId: CommandId.make(commandId),
        threadId: record.target.threadId,
        message: {
          messageId: MessageId.make(`${commandId}-message`),
          role: "user" as const,
          text: buildPortfolioHeartbeatPrompt(record, task),
          attachments: [],
        },
        runtimeMode: "full-access" as const,
        interactionMode: "default" as const,
        createdAt: nowIso,
      };

      yield* persist(environmentId, {
        ...record,
        status: "active",
        runCount: runNumber,
        nextRunAt: nextRunAt(record, now),
        updatedAt: nowIso,
      });

      const outcome = yield* engine.dispatch(command).pipe(
        Effect.map((result) => ({ accepted: true as const, sequence: result.sequence })),
        Effect.catch((error: unknown) =>
          Effect.succeed({
            accepted: false as const,
            detail: error instanceof Error ? error.message : "Native turn dispatch failed.",
          }),
        ),
      );
      const receipt = outcome.accepted
        ? makeReceipt({
            record,
            commandId,
            now: nowIso,
            status: "dispatched",
            sequence: outcome.sequence,
            detail: `Native thread.turn.start accepted for Heartbeat run ${runNumber}.`,
          })
        : makeReceipt({
            record,
            commandId,
            now: nowIso,
            status: "failed",
            detail: outcome.detail,
          });
      const terminalStatus = !outcome.accepted
        ? "blocked"
        : record.maxRuns !== null && runNumber >= record.maxRuns
          ? "exhausted"
          : "paused";

      yield* persist(environmentId, {
        ...record,
        status: terminalStatus,
        runCount: runNumber,
        nextRunAt: terminalStatus === "paused" ? nextRunAt(record, now) : null,
        lastReceipt: receipt,
        stopReason: outcome.accepted ? record.stopReason : receipt.detail,
        updatedAt: nowIso,
      });
      yield* owner
        .recordReceipt({
          ownerEnvironmentId: environmentId,
          receipt,
          updatedAt: nowIso,
        })
        .pipe(Effect.catch(() => Effect.void));
    }
  });

  yield* Effect.forkScoped(
    Effect.forever(Effect.sleep(SCHEDULER_POLL).pipe(Effect.andThen(runOnce))),
  );
  return PortfolioHeartbeatScheduler.of({ started: true });
});

export const layer = Layer.effect(PortfolioHeartbeatScheduler, make);
