import type {
  CommandId,
  MessageId,
  PortfolioHeartbeatReceipt,
  PortfolioTarget,
  ProviderInteractionMode,
  RuntimeMode,
} from "@t3tools/contracts";

import {
  buildPortfolioHeartbeatReceipt,
  decidePortfolioHeartbeatStart,
  type PortfolioHeartbeatLifecycle,
} from "./portfolioHeartbeatLifecycle";

export type PreparedPortfolioHeartbeatTurn = {
  readonly environmentId: PortfolioTarget["environmentId"];
  readonly projectId: PortfolioTarget["projectId"];
  readonly command: {
    readonly type: "thread.turn.start";
    readonly commandId: CommandId;
    readonly threadId: PortfolioTarget["threadId"];
    readonly message: {
      readonly messageId: MessageId;
      readonly role: "user";
      readonly text: string;
      readonly attachments: ReadonlyArray<never>;
    };
    readonly runtimeMode: RuntimeMode;
    readonly interactionMode: ProviderInteractionMode;
    readonly createdAt: string;
  };
};

export type PortfolioHeartbeatDispatchPreparation = {
  readonly accepted: boolean;
  readonly lifecycle: PortfolioHeartbeatLifecycle;
  readonly command: PreparedPortfolioHeartbeatTurn | null;
  readonly receipt: PortfolioHeartbeatReceipt;
};

export type PortfolioHeartbeatNativeDispatchResult =
  | { readonly accepted: true; readonly sequence: number }
  | { readonly accepted: false; readonly detail: string; readonly uncertain?: boolean };

export type PortfolioHeartbeatNativeSender = (
  command: PreparedPortfolioHeartbeatTurn,
) => Promise<PortfolioHeartbeatNativeDispatchResult>;

/**
 * Prepares exactly one bounded native turn. This is intentionally not a
 * dispatcher: the caller must still send the returned command through the
 * existing environment-scoped T3 command path and later reconcile its receipt.
 */
export function preparePortfolioHeartbeatNativeTurn(input: {
  readonly lifecycle: PortfolioHeartbeatLifecycle;
  readonly runId: string;
  readonly commandId: CommandId;
  readonly messageId: MessageId;
  readonly message: string;
  readonly now: string;
  readonly runtimeMode?: RuntimeMode;
  readonly interactionMode?: ProviderInteractionMode;
}): PortfolioHeartbeatDispatchPreparation {
  const message = input.message.trim();
  if (!message) {
    return {
      accepted: false,
      lifecycle: input.lifecycle,
      command: null,
      receipt: buildPortfolioHeartbeatReceipt({
        commandId: input.commandId,
        target: input.lifecycle.target,
        status: "failed",
        observedAt: input.now,
        detail: "A bounded Heartbeat turn requires a non-empty native message.",
      }),
    };
  }

  const decision = decidePortfolioHeartbeatStart(input.lifecycle, {
    runId: input.runId,
    now: input.now,
  });
  if (!decision.accepted) {
    return {
      accepted: false,
      lifecycle: decision.state,
      command: null,
      receipt: buildPortfolioHeartbeatReceipt({
        commandId: input.commandId,
        target: input.lifecycle.target,
        status: "failed",
        observedAt: input.now,
        detail: `Bounded Heartbeat turn was not prepared: ${decision.reason}.`,
      }),
    };
  }

  return {
    accepted: true,
    lifecycle: decision.state,
    command: {
      environmentId: input.lifecycle.target.environmentId,
      projectId: input.lifecycle.target.projectId,
      command: {
        type: "thread.turn.start",
        commandId: input.commandId,
        threadId: input.lifecycle.target.threadId,
        message: {
          messageId: input.messageId,
          role: "user",
          text: message,
          attachments: [],
        },
        runtimeMode: input.runtimeMode ?? "full-access",
        interactionMode: input.interactionMode ?? "default",
        createdAt: input.now,
      },
    },
    receipt: buildPortfolioHeartbeatReceipt({
      commandId: input.commandId,
      target: input.lifecycle.target,
      status: "accepted",
      observedAt: input.now,
      detail: "Bounded Heartbeat turn prepared; native dispatch is still pending.",
    }),
  };
}

/**
 * Executes exactly one already-bounded native turn through the caller's
 * environment-scoped T3 sender and converts its result into the shared
 * Heartbeat receipt vocabulary. Transport exceptions are deliberately
 * `uncertain`: the caller must not retry automatically or create a duplicate
 * turn when acceptance cannot be determined.
 */
export async function dispatchPortfolioHeartbeatNativeTurn(
  input: Parameters<typeof preparePortfolioHeartbeatNativeTurn>[0] & {
    readonly send: PortfolioHeartbeatNativeSender;
  },
): Promise<PortfolioHeartbeatDispatchPreparation> {
  const prepared = preparePortfolioHeartbeatNativeTurn(input);
  if (!prepared.accepted || prepared.command === null) {
    return prepared;
  }

  try {
    const result = await input.send(prepared.command);
    if (result.accepted) {
      return {
        ...prepared,
        receipt: buildPortfolioHeartbeatReceipt({
          commandId: input.commandId,
          target: input.lifecycle.target,
          status: "dispatched",
          observedAt: input.now,
          sequence: result.sequence,
          detail: `Bounded Heartbeat turn accepted by native T3 (sequence ${result.sequence}).`,
        }),
      };
    }

    return {
      ...prepared,
      lifecycle: result.uncertain ? prepared.lifecycle : input.lifecycle,
      receipt: buildPortfolioHeartbeatReceipt({
        commandId: input.commandId,
        target: input.lifecycle.target,
        status: result.uncertain ? "uncertain" : "failed",
        observedAt: input.now,
        detail: result.detail,
      }),
    };
  } catch (error) {
    return {
      ...prepared,
      receipt: buildPortfolioHeartbeatReceipt({
        commandId: input.commandId,
        target: input.lifecycle.target,
        status: "uncertain",
        observedAt: input.now,
        detail:
          error instanceof Error && error.message.trim().length > 0
            ? `Native Heartbeat dispatch outcome is uncertain: ${error.message}`
            : "Native Heartbeat dispatch outcome is uncertain.",
      }),
    };
  }
}
