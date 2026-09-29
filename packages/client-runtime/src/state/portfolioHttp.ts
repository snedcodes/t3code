import type {
  PortfolioHeartbeatWriteRequest,
  PortfolioHeartbeatsReadback,
  PortfolioTaskWriteRequest,
  PortfolioTasksReadback,
  PortfolioWishlistWriteRequest,
  PortfolioWishlistsReadback,
} from "@t3tools/contracts";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import { HttpClient } from "effect/unstable/http";

import { RemoteEnvironmentAuthorization } from "../authorization/service.ts";
import type { PreparedConnection } from "../connection/model.ts";
import { ManagedRelayDpopSigner } from "../relay/managedRelay.ts";
import { makeEnvironmentHttpApiUrlBuilder, type RemoteEnvironmentRequestError } from "../rpc/http.ts";
import { executeAuthenticatedEnvironmentHttpRequest } from "./environmentHttpAuth.ts";

const TIMEOUT_MS = 6_000;

export class PortfolioOwnerLoader extends Context.Service<PortfolioOwnerLoader, {
  readonly tasks: (prepared: PreparedConnection) => Effect.Effect<PortfolioTasksReadback, RemoteEnvironmentRequestError>;
  readonly writeTask: (prepared: PreparedConnection, payload: PortfolioTaskWriteRequest) => Effect.Effect<PortfolioTasksReadback, RemoteEnvironmentRequestError>;
  readonly heartbeats: (prepared: PreparedConnection) => Effect.Effect<PortfolioHeartbeatsReadback, RemoteEnvironmentRequestError>;
  readonly writeHeartbeat: (prepared: PreparedConnection, payload: PortfolioHeartbeatWriteRequest) => Effect.Effect<PortfolioHeartbeatsReadback, RemoteEnvironmentRequestError>;
  readonly wishlists: (prepared: PreparedConnection) => Effect.Effect<PortfolioWishlistsReadback, RemoteEnvironmentRequestError>;
  readonly writeWishlist: (prepared: PreparedConnection, payload: PortfolioWishlistWriteRequest) => Effect.Effect<PortfolioWishlistsReadback, RemoteEnvironmentRequestError>;
}>()("@t3tools/client-runtime/state/portfolioHttp/PortfolioOwnerLoader") {}

export const portfolioOwnerLoaderLayer: Layer.Layer<PortfolioOwnerLoader, never, HttpClient.HttpClient> = Layer.effect(
  PortfolioOwnerLoader,
  Effect.gen(function* () {
    const httpClient = yield* HttpClient.HttpClient;
    const signer = yield* Effect.serviceOption(ManagedRelayDpopSigner);
    const remoteAuthorization = yield* Effect.serviceOption(RemoteEnvironmentAuthorization);
    const tasks: PortfolioOwnerLoader["Service"]["tasks"] = (prepared) =>
      executeAuthenticatedEnvironmentHttpRequest({
        prepared,
        signer,
        remoteAuthorization,
        group: "portfolio",
        method: "GET",
        url: (baseUrl) => makeEnvironmentHttpApiUrlBuilder(baseUrl).portfolio.tasks(),
        timeoutMs: TIMEOUT_MS,
        request: ({ client, headers }) => client.tasks({ headers }),
      }).pipe(Effect.provideService(HttpClient.HttpClient, httpClient));
    const writeTask: PortfolioOwnerLoader["Service"]["writeTask"] = (prepared, payload) =>
      executeAuthenticatedEnvironmentHttpRequest({
        prepared,
        signer,
        remoteAuthorization,
        group: "portfolio",
        method: "POST",
        url: (baseUrl) => makeEnvironmentHttpApiUrlBuilder(baseUrl).portfolio.writeTask(),
        timeoutMs: TIMEOUT_MS,
        request: ({ client, headers }) => client.writeTask({ headers, payload }),
      }).pipe(Effect.provideService(HttpClient.HttpClient, httpClient));
    const heartbeats: PortfolioOwnerLoader["Service"]["heartbeats"] = (prepared) =>
      executeAuthenticatedEnvironmentHttpRequest({
        prepared,
        signer,
        remoteAuthorization,
        group: "portfolio",
        method: "GET",
        url: (baseUrl) => makeEnvironmentHttpApiUrlBuilder(baseUrl).portfolio.heartbeats(),
        timeoutMs: TIMEOUT_MS,
        request: ({ client, headers }) => client.heartbeats({ headers }),
      }).pipe(Effect.provideService(HttpClient.HttpClient, httpClient));
    const writeHeartbeat: PortfolioOwnerLoader["Service"]["writeHeartbeat"] = (prepared, payload) =>
      executeAuthenticatedEnvironmentHttpRequest({
        prepared,
        signer,
        remoteAuthorization,
        group: "portfolio",
        method: "POST",
        url: (baseUrl) => makeEnvironmentHttpApiUrlBuilder(baseUrl).portfolio.writeHeartbeat(),
        timeoutMs: TIMEOUT_MS,
        request: ({ client, headers }) => client.writeHeartbeat({ headers, payload }),
      }).pipe(Effect.provideService(HttpClient.HttpClient, httpClient));
    const wishlists: PortfolioOwnerLoader["Service"]["wishlists"] = (prepared) =>
      executeAuthenticatedEnvironmentHttpRequest({
        prepared,
        signer,
        remoteAuthorization,
        group: "portfolio",
        method: "GET",
        url: (baseUrl) => makeEnvironmentHttpApiUrlBuilder(baseUrl).portfolio.wishlists(),
        timeoutMs: TIMEOUT_MS,
        request: ({ client, headers }) => client.wishlists({ headers }),
      }).pipe(Effect.provideService(HttpClient.HttpClient, httpClient));
    const writeWishlist: PortfolioOwnerLoader["Service"]["writeWishlist"] = (prepared, payload) =>
      executeAuthenticatedEnvironmentHttpRequest({
        prepared,
        signer,
        remoteAuthorization,
        group: "portfolio",
        method: "POST",
        url: (baseUrl) => makeEnvironmentHttpApiUrlBuilder(baseUrl).portfolio.writeWishlist(),
        timeoutMs: TIMEOUT_MS,
        request: ({ client, headers }) => client.writeWishlist({ headers, payload }),
      }).pipe(Effect.provideService(HttpClient.HttpClient, httpClient));
    return PortfolioOwnerLoader.of({
      tasks,
      writeTask,
      heartbeats,
      writeHeartbeat,
      wishlists,
      writeWishlist,
    });
  }),
);
