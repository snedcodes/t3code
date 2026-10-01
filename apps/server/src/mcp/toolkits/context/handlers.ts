import * as Effect from "effect/Effect";
import { ContextRead, ContextReadError } from "../../../context/ContextRead.ts";
import { McpInvocationContext } from "../../McpInvocationContext.ts";
import { ContextReadToolkit } from "./tools.ts";

export const ContextReadToolkitHandlersLive = ContextReadToolkit.toLayer(
  Effect.gen(function* () {
    const context = yield* ContextRead;
    return ContextReadToolkit.of({
      context_read: (input) =>
        Effect.gen(function* () {
          const invocation = yield* McpInvocationContext;
          if (context.environmentId !== invocation.environmentId)
            return yield* new ContextReadError({
              status: 503,
              message: "Context belongs to a different environment.",
            });
          return yield* context.read(input);
        }),
    });
  }),
);
