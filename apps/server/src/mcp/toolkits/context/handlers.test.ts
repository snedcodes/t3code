import { describe, expect, it } from "@effect/vitest";
import { EnvironmentId, ProviderInstanceId, ThreadId } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Stream from "effect/Stream";
import { ContextRead } from "../../../context/ContextRead.ts";
import { McpInvocationContext, type McpCapability } from "../../McpInvocationContext.ts";
import { ContextReadToolkitHandlersLive } from "./handlers.ts";
import { ContextReadToolkit } from "./tools.ts";

describe("context MCP", () => {
  for (const sameEnvironment of [true, false]) {
    it.effect(
      sameEnvironment
        ? "reads another registered project by default without optional capabilities"
        : "rejects foreign-environment invocation before any context read",
      () =>
        Effect.gen(function* () {
          let reads = 0;
          const environmentId = EnvironmentId.make("environment");
          const service = ContextRead.of({
            environmentId,
            read: (input) =>
              Effect.sync(() => {
                reads++;
                return {
                  environmentId,
                  operation: input.operation,
                  data: { items: [{ id: "another-project" }] },
                  nextOffset: null,
                  truncated: false,
                };
              }),
          });
          const services = Layer.succeed(ContextRead, service);
          const toolkit = yield* ContextReadToolkit.pipe(
            Effect.provide(ContextReadToolkitHandlersLive.pipe(Layer.provide(services))),
          );
          const result = yield* toolkit.handle("context_read", { operation: "list_projects" }).pipe(
            Stream.unwrap,
            Stream.runCollect,
            Effect.provideService(McpInvocationContext, {
              environmentId: sameEnvironment ? environmentId : EnvironmentId.make("other"),
              threadId: ThreadId.make("caller-thread"),
              providerSessionId: "session",
              providerInstanceId: ProviderInstanceId.make("codex"),
              capabilities: new Set<McpCapability>(),
              issuedAt: 0,
            }),
            Effect.result,
          );
          expect(reads).toBe(sameEnvironment ? 1 : 0);
          expect(result._tag).toBe(sameEnvironment ? "Success" : "Failure");
        }),
    );
  }
});
