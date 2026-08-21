// @effect-diagnostics nodeBuiltinImport:off - CLI integration exercises Node HTTP and filesystem boundaries.
import * as NodeHttp from "node:http";
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import * as NodeServices from "@effect/platform-node/NodeServices";
import * as NetService from "@t3tools/shared/Net";
import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as TestConsole from "effect/testing/TestConsole";
import { Command } from "effect/unstable/cli";

import { cli } from "../bin.ts";
import * as ServerConfig from "../config.ts";
import {
  persistServerRuntimeState,
  type PersistedServerRuntimeState,
} from "../serverRuntimeState.ts";

const CliRuntimeLayer = Layer.mergeAll(NodeServices.layer, NetService.layer);

const runCli = (args: ReadonlyArray<string>) => Command.runWith(cli, { version: "0.0.0" })(args);

const provideCliTestLayers = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.provide(effect, Layer.mergeAll(CliRuntimeLayer, TestConsole.layer));

const withDispatchServer = <A, E, R>(
  run: (origin: string, requestBody: () => unknown) => Effect.Effect<A, E, R>,
) => {
  let receivedBody = "";
  return Effect.acquireUseRelease(
    Effect.callback<NodeHttp.Server>((resume) => {
      const server = NodeHttp.createServer((request, response) => {
        if (request.url !== "/api/orchestration/dispatch") {
          response.writeHead(404);
          response.end();
          return;
        }

        request.on("data", (chunk) => {
          receivedBody += chunk.toString();
        });
        request.on("end", () => {
          response.writeHead(200, { "content-type": "application/json" });
          response.end(JSON.stringify({ sequence: 42 }));
        });
      });
      server.listen(0, "127.0.0.1", () => resume(Effect.succeed(server)));
    }),
    (server) => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        return Effect.die(new Error("Expected a TCP address"));
      }
      return run(`http://127.0.0.1:${String(address.port)}`, () => JSON.parse(receivedBody));
    },
    (server) => Effect.sync(() => server.close()),
  );
};

const makeRuntimeState = (baseDir: string, origin: string) =>
  Effect.gen(function* () {
    const paths = yield* ServerConfig.deriveServerPaths(baseDir, undefined);
    NodeFS.mkdirSync(paths.stateDir, { recursive: true });
    yield* persistServerRuntimeState({
      path: paths.serverRuntimeStatePath,
      state: {
        version: 1,
        pid: process.pid,
        port: Number(new URL(origin).port),
        origin,
        startedAt: "2026-08-19T00:00:00.000Z",
      } satisfies PersistedServerRuntimeState,
    });
  });

it.effect("reports when no T3 server runtime state is available", () =>
  Effect.gen(function* () {
    const baseDir = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "t3-cli-turn-none-test-"));
    const error = yield* provideCliTestLayers(
      runCli(["turn", "interrupt", "thread-missing", "--base-dir", baseDir]).pipe(Effect.flip),
    );

    assert.include(String(error), "No running T3 server was found");
  }),
);

it.effect("prints the accepted receipt returned by the live dispatch endpoint", () =>
  withDispatchServer((origin, requestBody) =>
    Effect.gen(function* () {
      const baseDir = NodeFS.mkdtempSync(
        NodePath.join(NodeOS.tmpdir(), "t3-cli-turn-accepted-test-"),
      );
      yield* makeRuntimeState(baseDir, origin);

      const output = yield* provideCliTestLayers(
        Effect.gen(function* () {
          yield* runCli([
            "turn",
            "interrupt",
            "thread-accepted",
            "--turn-id",
            "turn-accepted",
            "--base-dir",
            baseDir,
          ]);
          return (
            (yield* TestConsole.logLines).findLast(
              (line): line is string => typeof line === "string",
            ) ?? ""
          );
        }),
      );

      assert.include(output, "accepted=true");
      assert.include(output, "sequence=42");
      assert.include(output, "threadId=thread-accepted");
      assert.include(output, "turnId=turn-accepted");

      const command = requestBody() as {
        readonly type: string;
        readonly threadId: string;
        readonly turnId?: string;
      };
      assert.equal(command.type, "thread.turn.interrupt");
      assert.equal(command.threadId, "thread-accepted");
      assert.equal(command.turnId, "turn-accepted");
    }),
  ).pipe(Effect.provide(NodeServices.layer)),
);
