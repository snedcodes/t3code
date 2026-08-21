import type {
  PortfolioHeartbeatOwnerClaimRequest,
  PortfolioHeartbeatOwnerReadback,
  PortfolioHeartbeatOwnerTransferPrepareRequest,
  PortfolioHeartbeatOwnerTransferTicket,
  PortfolioHeartbeatReceiptRecordRequest,
} from "@t3tools/contracts";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import { HttpClient } from "effect/unstable/http";

import type { PreparedConnection } from "../connection/model.ts";
import { environmentEndpointUrl } from "../environment/endpoint.ts";
import { ManagedRelayDpopSigner } from "../relay/managedRelay.ts";
import {
  executeEnvironmentHttpRequest,
  makeEnvironmentHttpApiClient,
  type RemoteEnvironmentRequestError,
} from "../rpc/http.ts";
import { buildEnvironmentAuthHeaders, withEnvironmentCredentials } from "./environmentHttpAuth.ts";

const DEFAULT_PORTFOLIO_OWNER_TIMEOUT_MS = 6_000;

export const fetchEnvironmentPortfolioHeartbeatOwner = Effect.fn(
  "clientRuntime.state.fetchEnvironmentPortfolioHeartbeatOwner",
)(function* (input: {
  readonly prepared: PreparedConnection;
  readonly signer: Option.Option<ManagedRelayDpopSigner["Service"]>;
  readonly timeoutMs?: number;
}) {
  const requestUrl = environmentEndpointUrl(
    input.prepared.httpBaseUrl,
    "/api/portfolio/heartbeat-owner",
  );
  const client = yield* makeEnvironmentHttpApiClient(input.prepared.httpBaseUrl);
  const headers = yield* buildEnvironmentAuthHeaders(
    input.prepared.httpAuthorization,
    "GET",
    requestUrl,
    input.signer,
  );
  return yield* executeEnvironmentHttpRequest(
    requestUrl,
    input.timeoutMs ?? DEFAULT_PORTFOLIO_OWNER_TIMEOUT_MS,
    withEnvironmentCredentials(
      input.prepared.httpAuthorization,
      client.portfolio.heartbeatOwner({ headers }),
    ),
  );
});

export const claimEnvironmentPortfolioHeartbeatOwner = Effect.fn(
  "clientRuntime.state.claimEnvironmentPortfolioHeartbeatOwner",
)(function* (input: {
  readonly prepared: PreparedConnection;
  readonly signer: Option.Option<ManagedRelayDpopSigner["Service"]>;
  readonly payload: PortfolioHeartbeatOwnerClaimRequest;
  readonly timeoutMs?: number;
}) {
  const requestUrl = environmentEndpointUrl(
    input.prepared.httpBaseUrl,
    "/api/portfolio/heartbeat-owner/claim",
  );
  const client = yield* makeEnvironmentHttpApiClient(input.prepared.httpBaseUrl);
  const headers = yield* buildEnvironmentAuthHeaders(
    input.prepared.httpAuthorization,
    "POST",
    requestUrl,
    input.signer,
  );
  return yield* executeEnvironmentHttpRequest(
    requestUrl,
    input.timeoutMs ?? DEFAULT_PORTFOLIO_OWNER_TIMEOUT_MS,
    withEnvironmentCredentials(
      input.prepared.httpAuthorization,
      client.portfolio.claimHeartbeatOwner({ headers, payload: input.payload }),
    ),
  );
});

export const recordEnvironmentPortfolioHeartbeatReceipt = Effect.fn(
  "clientRuntime.state.recordEnvironmentPortfolioHeartbeatReceipt",
)(function* (input: {
  readonly prepared: PreparedConnection;
  readonly signer: Option.Option<ManagedRelayDpopSigner["Service"]>;
  readonly payload: PortfolioHeartbeatReceiptRecordRequest;
  readonly timeoutMs?: number;
}) {
  const requestUrl = environmentEndpointUrl(
    input.prepared.httpBaseUrl,
    "/api/portfolio/heartbeat-owner/receipt",
  );
  const client = yield* makeEnvironmentHttpApiClient(input.prepared.httpBaseUrl);
  const headers = yield* buildEnvironmentAuthHeaders(
    input.prepared.httpAuthorization,
    "POST",
    requestUrl,
    input.signer,
  );
  return yield* executeEnvironmentHttpRequest(
    requestUrl,
    input.timeoutMs ?? DEFAULT_PORTFOLIO_OWNER_TIMEOUT_MS,
    withEnvironmentCredentials(
      input.prepared.httpAuthorization,
      client.portfolio.recordHeartbeatReceipt({ headers, payload: input.payload }),
    ),
  );
});

export const prepareEnvironmentPortfolioHeartbeatOwnerTransfer = Effect.fn(
  "clientRuntime.state.prepareEnvironmentPortfolioHeartbeatOwnerTransfer",
)(function* (input: {
  readonly prepared: PreparedConnection;
  readonly signer: Option.Option<ManagedRelayDpopSigner["Service"]>;
  readonly payload: PortfolioHeartbeatOwnerTransferPrepareRequest;
  readonly timeoutMs?: number;
}) {
  const requestUrl = environmentEndpointUrl(
    input.prepared.httpBaseUrl,
    "/api/portfolio/heartbeat-owner/transfer/prepare",
  );
  const client = yield* makeEnvironmentHttpApiClient(input.prepared.httpBaseUrl);
  const headers = yield* buildEnvironmentAuthHeaders(
    input.prepared.httpAuthorization,
    "POST",
    requestUrl,
    input.signer,
  );
  return yield* executeEnvironmentHttpRequest(
    requestUrl,
    input.timeoutMs ?? DEFAULT_PORTFOLIO_OWNER_TIMEOUT_MS,
    withEnvironmentCredentials(
      input.prepared.httpAuthorization,
      client.portfolio.prepareHeartbeatOwnerTransfer({ headers, payload: input.payload }),
    ),
  );
});

export const acceptEnvironmentPortfolioHeartbeatOwnerTransfer = Effect.fn(
  "clientRuntime.state.acceptEnvironmentPortfolioHeartbeatOwnerTransfer",
)(function* (input: {
  readonly prepared: PreparedConnection;
  readonly signer: Option.Option<ManagedRelayDpopSigner["Service"]>;
  readonly payload: PortfolioHeartbeatOwnerTransferTicket;
  readonly timeoutMs?: number;
}) {
  const requestUrl = environmentEndpointUrl(
    input.prepared.httpBaseUrl,
    "/api/portfolio/heartbeat-owner/transfer/accept",
  );
  const client = yield* makeEnvironmentHttpApiClient(input.prepared.httpBaseUrl);
  const headers = yield* buildEnvironmentAuthHeaders(
    input.prepared.httpAuthorization,
    "POST",
    requestUrl,
    input.signer,
  );
  return yield* executeEnvironmentHttpRequest(
    requestUrl,
    input.timeoutMs ?? DEFAULT_PORTFOLIO_OWNER_TIMEOUT_MS,
    withEnvironmentCredentials(
      input.prepared.httpAuthorization,
      client.portfolio.acceptHeartbeatOwnerTransfer({ headers, payload: input.payload }),
    ),
  );
});

export const finalizeEnvironmentPortfolioHeartbeatOwnerTransfer = Effect.fn(
  "clientRuntime.state.finalizeEnvironmentPortfolioHeartbeatOwnerTransfer",
)(function* (input: {
  readonly prepared: PreparedConnection;
  readonly signer: Option.Option<ManagedRelayDpopSigner["Service"]>;
  readonly payload: PortfolioHeartbeatOwnerTransferTicket;
  readonly timeoutMs?: number;
}) {
  const requestUrl = environmentEndpointUrl(
    input.prepared.httpBaseUrl,
    "/api/portfolio/heartbeat-owner/transfer/finalize",
  );
  const client = yield* makeEnvironmentHttpApiClient(input.prepared.httpBaseUrl);
  const headers = yield* buildEnvironmentAuthHeaders(
    input.prepared.httpAuthorization,
    "POST",
    requestUrl,
    input.signer,
  );
  return yield* executeEnvironmentHttpRequest(
    requestUrl,
    input.timeoutMs ?? DEFAULT_PORTFOLIO_OWNER_TIMEOUT_MS,
    withEnvironmentCredentials(
      input.prepared.httpAuthorization,
      client.portfolio.finalizeHeartbeatOwnerTransfer({ headers, payload: input.payload }),
    ),
  );
});

export class PortfolioHeartbeatOwnerLoader extends Context.Service<
  PortfolioHeartbeatOwnerLoader,
  {
    readonly load: (
      prepared: PreparedConnection,
    ) => Effect.Effect<PortfolioHeartbeatOwnerReadback, RemoteEnvironmentRequestError>;
    readonly claim: (
      prepared: PreparedConnection,
      payload: PortfolioHeartbeatOwnerClaimRequest,
    ) => Effect.Effect<PortfolioHeartbeatOwnerReadback, RemoteEnvironmentRequestError>;
    readonly recordReceipt: (
      prepared: PreparedConnection,
      payload: PortfolioHeartbeatReceiptRecordRequest,
    ) => Effect.Effect<PortfolioHeartbeatOwnerReadback, RemoteEnvironmentRequestError>;
    readonly prepareTransfer: (
      prepared: PreparedConnection,
      payload: PortfolioHeartbeatOwnerTransferPrepareRequest,
    ) => Effect.Effect<PortfolioHeartbeatOwnerTransferTicket, RemoteEnvironmentRequestError>;
    readonly acceptTransfer: (
      prepared: PreparedConnection,
      payload: PortfolioHeartbeatOwnerTransferTicket,
    ) => Effect.Effect<PortfolioHeartbeatOwnerReadback, RemoteEnvironmentRequestError>;
    readonly finalizeTransfer: (
      prepared: PreparedConnection,
      payload: PortfolioHeartbeatOwnerTransferTicket,
    ) => Effect.Effect<PortfolioHeartbeatOwnerReadback, RemoteEnvironmentRequestError>;
  }
>()("@t3tools/client-runtime/state/portfolioHeartbeatOwnerHttp/PortfolioHeartbeatOwnerLoader") {}

export const portfolioHeartbeatOwnerLoaderLayer: Layer.Layer<
  PortfolioHeartbeatOwnerLoader,
  never,
  HttpClient.HttpClient
> = Layer.effect(
  PortfolioHeartbeatOwnerLoader,
  Effect.gen(function* () {
    const httpClient = yield* HttpClient.HttpClient;
    const signer = yield* Effect.serviceOption(ManagedRelayDpopSigner);
    return PortfolioHeartbeatOwnerLoader.of({
      load: (prepared) =>
        fetchEnvironmentPortfolioHeartbeatOwner({ prepared, signer }).pipe(
          Effect.provideService(HttpClient.HttpClient, httpClient),
        ),
      claim: (prepared, payload) =>
        claimEnvironmentPortfolioHeartbeatOwner({ prepared, signer, payload }).pipe(
          Effect.provideService(HttpClient.HttpClient, httpClient),
        ),
      recordReceipt: (prepared, payload) =>
        recordEnvironmentPortfolioHeartbeatReceipt({ prepared, signer, payload }).pipe(
          Effect.provideService(HttpClient.HttpClient, httpClient),
        ),
      prepareTransfer: (prepared, payload) =>
        prepareEnvironmentPortfolioHeartbeatOwnerTransfer({ prepared, signer, payload }).pipe(
          Effect.provideService(HttpClient.HttpClient, httpClient),
        ),
      acceptTransfer: (prepared, payload) =>
        acceptEnvironmentPortfolioHeartbeatOwnerTransfer({ prepared, signer, payload }).pipe(
          Effect.provideService(HttpClient.HttpClient, httpClient),
        ),
      finalizeTransfer: (prepared, payload) =>
        finalizeEnvironmentPortfolioHeartbeatOwnerTransfer({ prepared, signer, payload }).pipe(
          Effect.provideService(HttpClient.HttpClient, httpClient),
        ),
    });
  }),
);
