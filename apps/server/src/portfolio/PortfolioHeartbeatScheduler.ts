import { CommandId, MessageId, type OrchestrationCommand, type PortfolioHeartbeat, type PortfolioReceipt } from "@t3tools/contracts";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { OrchestrationEngineService } from "../orchestration/Services/OrchestrationEngine.ts";
import * as ServerEnvironment from "../environment/ServerEnvironment.ts";
import * as PortfolioOwner from "./PortfolioOwner.ts";

const SCHEDULER_POLL = Duration.seconds(15);

export function buildPortfolioHeartbeatPrompt(heartbeat: PortfolioHeartbeat, task: {
  readonly title: string;
  readonly outcome: string;
  readonly completionCondition: string;
  readonly checklistItems: ReadonlyArray<{ readonly text: string; readonly state: string }>;
} | null): string {
  const message = heartbeat.message?.trim();
  if (message) return message;
  if (task === null) return `Run the standalone Heartbeat "${heartbeat.heartbeatId}" for its exact target. Complete one bounded check, record the outcome, and stop when its stop conditions are met.`;
  const incomplete = task.checklistItems.filter((item) => item.state !== "complete").map((item) => `- [${item.state}] ${item.text}`).join("\n");
  return [`Continue Task "${task.title}" (${heartbeat.taskId}).`, `Outcome: ${task.outcome}`, `Incomplete checklist:\n${incomplete || "- None; verify the completion condition."}`, `Completion condition: ${task.completionCondition}`, `When complete, update Task ${heartbeat.taskId} and stop Heartbeat ${heartbeat.heartbeatId}.`].join("\n\n");
}

function receipt(heartbeat: PortfolioHeartbeat, now: string, commandId: string, status: PortfolioReceipt["status"], detail: string, sequence?: number): PortfolioReceipt {
  return {
    commandId,
    target: heartbeat.target,
    status,
    ...(sequence === undefined ? {} : { sequence }),
    observedAt: now,
    detail,
  };
}

export class PortfolioHeartbeatScheduler extends Context.Service<PortfolioHeartbeatScheduler, { readonly started: true }>()("t3/portfolio/PortfolioHeartbeatScheduler") {}

export const layer = Layer.effect(PortfolioHeartbeatScheduler, Effect.gen(function* () {
  const owner = yield* PortfolioOwner.PortfolioOwner;
  const environment = yield* ServerEnvironment.ServerEnvironment;
  const engine = yield* OrchestrationEngineService;
  const localEnvironmentId = yield* environment.getEnvironmentId;

  const runDue = Effect.fn("PortfolioHeartbeatScheduler.runDue")(function* () {
    const readback = yield* owner.readHeartbeats;
    const tasks = yield* owner.readTasks;
    for (const heartbeat of readback.heartbeats) {
      if (heartbeat.status !== "active" || heartbeat.nextRunAt === null) continue;
      if (heartbeat.target.environmentId !== localEnvironmentId) continue;
      const now = yield* DateTime.now;
      const nowIso = DateTime.formatIso(now);
      if (Date.parse(heartbeat.nextRunAt) > now.epochMilliseconds) continue;
      const task = heartbeat.taskId === null ? null : tasks.tasks.find((candidate) => candidate.taskId === heartbeat.taskId) ?? null;
      if (heartbeat.taskId !== null && task === null) {
        yield* owner.writeHeartbeat({ expectedRevision: heartbeat.revision, heartbeat: { ...heartbeat, status: "blocked", nextRunAt: null, stopReason: `Linked Task ${heartbeat.taskId} was not found.`, updatedAt: nowIso } });
        continue;
      }
      if (task && ["complete", "blocked", "cancelled"].includes(task.status)) {
        yield* owner.writeHeartbeat({ expectedRevision: heartbeat.revision, heartbeat: { ...heartbeat, status: task.status === "complete" ? "completed" : "stopped", nextRunAt: null, stopReason: `Linked Task ${task.status}.`, updatedAt: nowIso } });
        continue;
      }
      if (heartbeat.expiresAt !== null && Date.parse(heartbeat.expiresAt) <= now.epochMilliseconds) {
        yield* owner.writeHeartbeat({ expectedRevision: heartbeat.revision, heartbeat: { ...heartbeat, status: "expired", nextRunAt: null, stopReason: "Heartbeat expired.", updatedAt: nowIso } });
        continue;
      }
      if (heartbeat.maxRuns !== null && heartbeat.runCount >= heartbeat.maxRuns) {
        yield* owner.writeHeartbeat({ expectedRevision: heartbeat.revision, heartbeat: { ...heartbeat, status: "exhausted", nextRunAt: null, stopReason: "Maximum runs reached.", updatedAt: nowIso } });
        continue;
      }

      const runNumber = heartbeat.runCount + 1;
      const commandId = `heartbeat-${heartbeat.heartbeatId}-run-${runNumber}`;
      const command: OrchestrationCommand = {
        type: "thread.turn.start",
        commandId: CommandId.make(commandId),
        threadId: heartbeat.target.threadId,
        message: { messageId: MessageId.make(`${commandId}-message`), role: "user", text: buildPortfolioHeartbeatPrompt(heartbeat, task), attachments: [] },
        runtimeMode: "full-access",
        interactionMode: "default",
        createdAt: nowIso,
      };
      const nextRunAt = heartbeat.cadenceMinutes === null ? null : DateTime.formatIso(DateTime.add(now, { minutes: heartbeat.cadenceMinutes }));
      const result = yield* engine.dispatch(command).pipe(
        Effect.map((value) => ({ accepted: true as const, sequence: value.sequence })),
        Effect.catch((error) => Effect.succeed({ accepted: false as const, detail: error instanceof Error ? error.message : "Native thread.turn.start failed." })),
      );
      const isTerminal = !result.accepted || nextRunAt === null || (heartbeat.maxRuns !== null && runNumber >= heartbeat.maxRuns);
      const runReceipt = result.accepted
        ? receipt(heartbeat, nowIso, commandId, "dispatched", `Native thread.turn.start accepted for run ${runNumber}.`, result.sequence)
        : receipt(heartbeat, nowIso, commandId, "failed", result.detail);
      yield* owner.writeHeartbeat({
        expectedRevision: heartbeat.revision,
        heartbeat: {
          ...heartbeat,
          status: result.accepted ? (isTerminal ? "completed" : "active") : "blocked",
          runCount: runNumber,
          nextRunAt: isTerminal ? null : nextRunAt,
          lastReceipt: runReceipt,
          stopReason: result.accepted ? null : runReceipt.detail,
          updatedAt: nowIso,
        },
      });
    }
  });

  yield* Effect.forkScoped(Effect.forever(Effect.sleep(SCHEDULER_POLL).pipe(Effect.andThen(runDue))));
  return PortfolioHeartbeatScheduler.of({ started: true });
}));
