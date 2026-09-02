import type {
  PortfolioHeartbeatOwnerClaimRequest,
  PortfolioHeartbeatOwnerReadback,
  PortfolioHeartbeatOwnerTransferPrepareRequest,
  PortfolioHeartbeatOwnerTransferTicket,
  PortfolioHeartbeatReceiptRecordRequest,
  PortfolioHeartbeatRecordUpsertRequest,
  PortfolioHeartbeatRecordsReadback,
  PortfolioTaskCreateRequest,
  PortfolioTaskReceiptRecordReadback,
  PortfolioTaskReceiptRecordRequest,
  PortfolioTaskStatusTransitionReadback,
  PortfolioTaskStatusTransitionRequest,
  PortfolioTaskUpdateReadback,
  PortfolioTaskUpdateRequest,
  PortfolioTasksReadback,
  PortfolioWishlistCreateRequest,
  PortfolioWishlistPromotionReadback,
  PortfolioWishlistPromotionRequest,
  PortfolioWishlistsReadback,
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

export const fetchEnvironmentPortfolioHeartbeatRecords = Effect.fn(
  "clientRuntime.state.fetchEnvironmentPortfolioHeartbeatRecords",
)(function* (input: {
  readonly prepared: PreparedConnection;
  readonly signer: Option.Option<ManagedRelayDpopSigner["Service"]>;
  readonly timeoutMs?: number;
}) {
  const requestUrl = environmentEndpointUrl(
    input.prepared.httpBaseUrl,
    "/api/portfolio/heartbeats",
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
      client.portfolio.heartbeatRecords({ headers }),
    ),
  ) as Effect.Effect<PortfolioHeartbeatRecordsReadback, RemoteEnvironmentRequestError>;
});

export const upsertEnvironmentPortfolioHeartbeatRecord = Effect.fn(
  "clientRuntime.state.upsertEnvironmentPortfolioHeartbeatRecord",
)(function* (input: {
  readonly prepared: PreparedConnection;
  readonly signer: Option.Option<ManagedRelayDpopSigner["Service"]>;
  readonly payload: PortfolioHeartbeatRecordUpsertRequest;
  readonly timeoutMs?: number;
}) {
  const requestUrl = environmentEndpointUrl(
    input.prepared.httpBaseUrl,
    "/api/portfolio/heartbeats",
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
      client.portfolio.upsertHeartbeatRecord({ headers, payload: input.payload }),
    ),
  ) as Effect.Effect<PortfolioHeartbeatRecordsReadback, RemoteEnvironmentRequestError>;
});

export const fetchEnvironmentPortfolioTasks = Effect.fn(
  "clientRuntime.state.fetchEnvironmentPortfolioTasks",
)(function* (input: {
  readonly prepared: PreparedConnection;
  readonly signer: Option.Option<ManagedRelayDpopSigner["Service"]>;
  readonly timeoutMs?: number;
}) {
  const requestUrl = environmentEndpointUrl(input.prepared.httpBaseUrl, "/api/portfolio/tasks");
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
      client.portfolio.tasks({ headers }),
    ),
  );
});

export const createEnvironmentPortfolioTask = Effect.fn(
  "clientRuntime.state.createEnvironmentPortfolioTask",
)(function* (input: {
  readonly prepared: PreparedConnection;
  readonly signer: Option.Option<ManagedRelayDpopSigner["Service"]>;
  readonly payload: PortfolioTaskCreateRequest;
  readonly timeoutMs?: number;
}) {
  const requestUrl = environmentEndpointUrl(input.prepared.httpBaseUrl, "/api/portfolio/tasks");
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
      client.portfolio.createTask({ headers, payload: input.payload }),
    ),
  );
});

export const transitionEnvironmentPortfolioTaskStatus = Effect.fn(
  "clientRuntime.state.transitionEnvironmentPortfolioTaskStatus",
)(function* (input: {
  readonly prepared: PreparedConnection;
  readonly signer: Option.Option<ManagedRelayDpopSigner["Service"]>;
  readonly payload: PortfolioTaskStatusTransitionRequest;
  readonly timeoutMs?: number;
}) {
  const requestUrl = environmentEndpointUrl(
    input.prepared.httpBaseUrl,
    "/api/portfolio/tasks/status",
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
      client.portfolio.transitionTaskStatus({ headers, payload: input.payload }),
    ),
  ) as Effect.Effect<PortfolioTaskStatusTransitionReadback, RemoteEnvironmentRequestError>;
});

export const updateEnvironmentPortfolioTask = Effect.fn(
  "clientRuntime.state.updateEnvironmentPortfolioTask",
)(function* (input: {
  readonly prepared: PreparedConnection;
  readonly signer: Option.Option<ManagedRelayDpopSigner["Service"]>;
  readonly payload: PortfolioTaskUpdateRequest;
  readonly timeoutMs?: number;
}) {
  const requestUrl = environmentEndpointUrl(
    input.prepared.httpBaseUrl,
    "/api/portfolio/tasks/update",
  );
  const client = yield* makeEnvironmentHttpApiClient(input.prepared.httpBaseUrl);
  const headers = yield* buildEnvironmentAuthHeaders(
    input.prepared.httpAuthorization,
    "POST",
    requestUrl,
    input.signer,
  );
  return (yield* executeEnvironmentHttpRequest(
    requestUrl,
    input.timeoutMs ?? DEFAULT_PORTFOLIO_OWNER_TIMEOUT_MS,
    withEnvironmentCredentials(
      input.prepared.httpAuthorization,
      client.portfolio.updateTask({ headers, payload: input.payload }),
    ),
  )) as PortfolioTaskUpdateReadback;
});

export const recordEnvironmentPortfolioTaskReceipt = Effect.fn(
  "clientRuntime.state.recordEnvironmentPortfolioTaskReceipt",
)(function* (input: {
  readonly prepared: PreparedConnection;
  readonly signer: Option.Option<ManagedRelayDpopSigner["Service"]>;
  readonly payload: PortfolioTaskReceiptRecordRequest;
  readonly timeoutMs?: number;
}) {
  const requestUrl = environmentEndpointUrl(
    input.prepared.httpBaseUrl,
    "/api/portfolio/tasks/receipt",
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
      client.portfolio.recordTaskReceipt({ headers, payload: input.payload }),
    ),
  ) as Effect.Effect<PortfolioTaskReceiptRecordReadback, RemoteEnvironmentRequestError>;
});

export const fetchEnvironmentPortfolioWishlists = Effect.fn(
  "clientRuntime.state.fetchEnvironmentPortfolioWishlists",
)(function* (input: {
  readonly prepared: PreparedConnection;
  readonly signer: Option.Option<ManagedRelayDpopSigner["Service"]>;
  readonly timeoutMs?: number;
}) {
  const requestUrl = environmentEndpointUrl(input.prepared.httpBaseUrl, "/api/portfolio/wishlists");
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
      client.portfolio.wishlists({ headers }),
    ),
  );
});

export const createEnvironmentPortfolioWishlist = Effect.fn(
  "clientRuntime.state.createEnvironmentPortfolioWishlist",
)(function* (input: {
  readonly prepared: PreparedConnection;
  readonly signer: Option.Option<ManagedRelayDpopSigner["Service"]>;
  readonly payload: PortfolioWishlistCreateRequest;
  readonly timeoutMs?: number;
}) {
  const requestUrl = environmentEndpointUrl(input.prepared.httpBaseUrl, "/api/portfolio/wishlists");
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
      client.portfolio.createWishlist({ headers, payload: input.payload }),
    ),
  );
});

export const promoteEnvironmentPortfolioWishlist = Effect.fn(
  "clientRuntime.state.promoteEnvironmentPortfolioWishlist",
)(function* (input: {
  readonly prepared: PreparedConnection;
  readonly signer: Option.Option<ManagedRelayDpopSigner["Service"]>;
  readonly payload: PortfolioWishlistPromotionRequest;
  readonly timeoutMs?: number;
}) {
  const requestUrl = environmentEndpointUrl(
    input.prepared.httpBaseUrl,
    "/api/portfolio/wishlists/promote",
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
      client.portfolio.promoteWishlist({ headers, payload: input.payload }),
    ),
  ) as Effect.Effect<PortfolioWishlistPromotionReadback, RemoteEnvironmentRequestError>;
});

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
    readonly tasks: (
      prepared: PreparedConnection,
    ) => Effect.Effect<PortfolioTasksReadback, RemoteEnvironmentRequestError>;
    readonly createTask: (
      prepared: PreparedConnection,
      payload: PortfolioTaskCreateRequest,
    ) => Effect.Effect<PortfolioTasksReadback, RemoteEnvironmentRequestError>;
    readonly transitionTaskStatus: (
      prepared: PreparedConnection,
      payload: PortfolioTaskStatusTransitionRequest,
    ) => Effect.Effect<PortfolioTaskStatusTransitionReadback, RemoteEnvironmentRequestError>;
    readonly updateTask: (
      prepared: PreparedConnection,
      payload: PortfolioTaskUpdateRequest,
    ) => Effect.Effect<PortfolioTaskUpdateReadback, RemoteEnvironmentRequestError>;
    readonly recordTaskReceipt: (
      prepared: PreparedConnection,
      payload: PortfolioTaskReceiptRecordRequest,
    ) => Effect.Effect<PortfolioTaskReceiptRecordReadback, RemoteEnvironmentRequestError>;
    readonly heartbeatRecords: (
      prepared: PreparedConnection,
    ) => Effect.Effect<PortfolioHeartbeatRecordsReadback, RemoteEnvironmentRequestError>;
    readonly upsertHeartbeatRecord: (
      prepared: PreparedConnection,
      payload: PortfolioHeartbeatRecordUpsertRequest,
    ) => Effect.Effect<PortfolioHeartbeatRecordsReadback, RemoteEnvironmentRequestError>;
    readonly wishlists: (
      prepared: PreparedConnection,
    ) => Effect.Effect<PortfolioWishlistsReadback, RemoteEnvironmentRequestError>;
    readonly createWishlist: (
      prepared: PreparedConnection,
      payload: PortfolioWishlistCreateRequest,
    ) => Effect.Effect<PortfolioWishlistsReadback, RemoteEnvironmentRequestError>;
    readonly promoteWishlist: (
      prepared: PreparedConnection,
      payload: PortfolioWishlistPromotionRequest,
    ) => Effect.Effect<PortfolioWishlistPromotionReadback, RemoteEnvironmentRequestError>;
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
      tasks: (prepared) =>
        fetchEnvironmentPortfolioTasks({ prepared, signer }).pipe(
          Effect.provideService(HttpClient.HttpClient, httpClient),
        ),
      createTask: (prepared, payload) =>
        createEnvironmentPortfolioTask({ prepared, signer, payload }).pipe(
          Effect.provideService(HttpClient.HttpClient, httpClient),
        ),
      transitionTaskStatus: (prepared, payload) =>
        transitionEnvironmentPortfolioTaskStatus({ prepared, signer, payload }).pipe(
          Effect.provideService(HttpClient.HttpClient, httpClient),
        ),
      updateTask: (prepared, payload) =>
        updateEnvironmentPortfolioTask({ prepared, signer, payload }).pipe(
          Effect.provideService(HttpClient.HttpClient, httpClient),
        ),
      recordTaskReceipt: (prepared, payload) =>
        recordEnvironmentPortfolioTaskReceipt({ prepared, signer, payload }).pipe(
          Effect.provideService(HttpClient.HttpClient, httpClient),
        ),
      heartbeatRecords: (prepared) =>
        fetchEnvironmentPortfolioHeartbeatRecords({ prepared, signer }).pipe(
          Effect.provideService(HttpClient.HttpClient, httpClient),
        ),
      upsertHeartbeatRecord: (prepared, payload) =>
        upsertEnvironmentPortfolioHeartbeatRecord({ prepared, signer, payload }).pipe(
          Effect.provideService(HttpClient.HttpClient, httpClient),
        ),
      wishlists: (prepared) =>
        fetchEnvironmentPortfolioWishlists({ prepared, signer }).pipe(
          Effect.provideService(HttpClient.HttpClient, httpClient),
        ),
      createWishlist: (prepared, payload) =>
        createEnvironmentPortfolioWishlist({ prepared, signer, payload }).pipe(
          Effect.provideService(HttpClient.HttpClient, httpClient),
        ),
      promoteWishlist: (prepared, payload) =>
        promoteEnvironmentPortfolioWishlist({ prepared, signer, payload }).pipe(
          Effect.provideService(HttpClient.HttpClient, httpClient),
        ),
    });
  }),
);
