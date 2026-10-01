import { EnvironmentId } from "@t3tools/contracts";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as SubscriptionRef from "effect/SubscriptionRef";
import { Atom, AtomRegistry } from "effect/unstable/reactivity";

import { RemoteEnvironmentAuthorization } from "../authorization/service.ts";
import {
  AVAILABLE_CONNECTION_STATE,
  PrimaryConnectionTarget,
  type PreparedConnection,
} from "../connection/model.ts";
import type { ConnectionCatalogEntry } from "../connection/catalog.ts";
import { EnvironmentRegistry } from "../connection/registry.ts";
import { ManagedRelayDpopSigner } from "../relay/managedRelay.ts";
import { remoteHttpClientLayer } from "../rpc/http.ts";
import {
  createPortfolioContextSourcesCommand,
  fetchEnvironmentPortfolioContextRead,
} from "./portfolioContextHttp.ts";
import { runAtomCommand } from "./runtime.ts";

const target = new PrimaryConnectionTarget({
  environmentId: EnvironmentId.make("exact-env"),
  label: "Exact",
  httpBaseUrl: "https://exact.test",
  wsBaseUrl: "wss://exact.test",
});
const prepared: PreparedConnection = {
  environmentId: target.environmentId,
  label: target.label,
  httpBaseUrl: target.httpBaseUrl,
  socketUrl: target.wsBaseUrl,
  httpAuthorization: null,
  target,
};
const response = {
  environmentId: target.environmentId,
  operation: "list_projects",
  data: [{ projectId: "project" }],
  nextOffset: 100,
  truncated: true,
};

describe("portfolio context authenticated HTTP", () => {
  it.effect(
    "discovers connected and offline enabled sources while excluding disabled sources",
    () =>
      Effect.gen(function* () {
        const entries = new Map<EnvironmentId, ConnectionCatalogEntry>();
        for (const id of ["connected", "offline", "disabled"]) {
          const source = new PrimaryConnectionTarget({
            environmentId: EnvironmentId.make(id),
            label: id,
            httpBaseUrl: `https://${id}.test`,
            wsBaseUrl: `wss://${id}.test`,
          });
          entries.set(source.environmentId, {
            target: source,
            profile: Option.none(),
            enabled: id !== "disabled",
          });
        }
        const inspected: string[] = [];
        const environments = EnvironmentRegistry.of({
          entries: yield* SubscriptionRef.make(entries),
          state: (environmentId: EnvironmentId) =>
            Effect.sync(() => {
              inspected.push(environmentId);
              return {
                ...AVAILABLE_CONNECTION_STATE,
                phase:
                  environmentId === "connected" ? ("connected" as const) : ("offline" as const),
              };
            }),
      } as unknown as EnvironmentRegistry["Service"]);
        const runtime = Atom.runtime(Layer.succeed(EnvironmentRegistry, environments));
        const registry = AtomRegistry.make();
        try {
          const result = yield* Effect.promise(() =>
            runAtomCommand(registry, createPortfolioContextSourcesCommand(runtime), undefined),
          );
          expect(result).toMatchObject({
            _tag: "Success",
            value: {
              sources: [
                {
                  environmentId: "connected",
                  label: "connected",
                  connected: true,
                  state: "connected",
                },
                { environmentId: "offline", label: "offline", connected: false, state: "offline" },
              ],
            },
          });
          expect(inspected).toEqual(["connected", "offline"]);
        } finally {
          registry.dispose();
        }
      }),
  );
  for (const bearer of [false, true]) {
    it.effect(
      `posts exact context with ${bearer ? "bearer" : "cookie"} auth and retains continuation`,
      () =>
        Effect.gen(function* () {
          const calls: Array<{ url: string; init: RequestInit }> = [];
          const fetchFn: typeof fetch = async (url, init) => {
            calls.push({ url: String(url), init: init ?? {} });
            return Response.json(response);
          };
          const result = yield* fetchEnvironmentPortfolioContextRead({
            prepared: {
              ...prepared,
              httpAuthorization: bearer ? { _tag: "Bearer", token: "test-bearer" } : null,
            },
            request: { operation: "list_projects", offset: 25, limit: 100 },
            signer: Option.none(),
          }).pipe(Effect.provide(remoteHttpClientLayer(fetchFn)));
          expect(result).toEqual(response);
          expect(calls[0]!.url).toBe("https://exact.test/api/context/read");
          expect(calls[0]!.init.method).toBe("POST");
          expect(calls[0]!.init.credentials).toBe(bearer ? undefined : "include");
          expect(new Headers(calls[0]!.init.headers).get("authorization")).toBe(
            bearer ? "Bearer test-bearer" : null,
          );
        }),
    );
  }

  it.effect("renews relay authorization and signs the current exact request URL", () =>
    Effect.gen(function* () {
      const urls: string[] = [];
      const proofs: Array<{ method: string; url: string; accessToken?: string }> = [];
      const rejected: Array<string | undefined> = [];
      const authorization = RemoteEnvironmentAuthorization.of({
        authorizeBearer: () => Effect.die("unused"),
        authorizeDpop: () => Effect.die("unused"),
        authorizeDpopHttp: (input) =>
          Effect.sync(() => {
            expect(input.expectedEnvironmentId).toBe(target.environmentId);
            rejected.push(input.rejectedAccessToken);
            return {
              environmentId: target.environmentId,
              label: "Exact",
              httpBaseUrl: input.rejectedAccessToken
                ? "https://renewed.test"
                : "https://current.test",
              httpAuthorization: {
                _tag: "Dpop" as const,
                accessToken: input.rejectedAccessToken ? "renewed" : "current",
                expiresAtEpochMs: 9999999,
              },
            };
          }),
      });
      const signer = ManagedRelayDpopSigner.of({
        thumbprint: Effect.succeed("test"),
        createProof: (input) =>
          Effect.sync(() => {
            proofs.push(input);
            return "proof";
          }),
      });
      const fetchFn: typeof fetch = async (url) => {
        urls.push(String(url));
        return urls.length === 1
          ? Response.json(
              {
                _tag: "EnvironmentAuthInvalidError",
                code: "auth_invalid",
                reason: "invalid_credential",
                traceId: "test",
              },
              { status: 401 },
            )
          : Response.json(response);
      };
      yield* fetchEnvironmentPortfolioContextRead({
        prepared: {
          ...prepared,
          httpAuthorization: { _tag: "Dpop", accessToken: "old", expiresAtEpochMs: 0 },
        },
        request: { operation: "list_projects" },
        signer: Option.some(signer),
        remoteAuthorization: Option.some(authorization),
      }).pipe(Effect.provide(remoteHttpClientLayer(fetchFn)));
      expect(urls).toEqual([
        "https://current.test/api/context/read",
        "https://renewed.test/api/context/read",
      ]);
      expect(rejected).toEqual([undefined, "current"]);
      expect(proofs.map(({ method, url }) => ({ method, url }))).toEqual(
        urls.map((url) => ({ method: "POST", url })),
      );
    }),
  );

  it.effect("rejects another environment's response without reflecting its contents", () =>
    Effect.gen(function* () {
      const fetchFn: typeof fetch = async () =>
        Response.json({ ...response, environmentId: "wrong-env", data: "private-source-text" });
      const error = yield* fetchEnvironmentPortfolioContextRead({
        prepared,
        request: { operation: "list_projects" },
        signer: Option.none(),
      }).pipe(Effect.provide(remoteHttpClientLayer(fetchFn)), Effect.flip);
      expect(error.message).toContain("another target");
      expect(error.message).not.toContain("private-source-text");
    }),
  );
});
