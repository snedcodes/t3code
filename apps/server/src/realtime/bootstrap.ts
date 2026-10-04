import { AuthOrchestrationOperateScope } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import {
  HttpRouter,
  HttpServerRequest,
  HttpServerRespondable,
  HttpServerResponse,
} from "effect/unstable/http";
import { authenticateRawRouteWithScope } from "../http.ts";
import * as Bootstrap from "./RealtimeBootstrap.ts";

const headers = { "cache-control": "no-store", pragma: "no-cache" };
export const realtimeClientSecretsRouteLayer = Layer.unwrap(
  Effect.gen(function* () {
    const bootstrap = yield* Bootstrap.RealtimeBootstrap;
    return HttpRouter.add(
      "POST",
      "/api/realtime/client-secrets",
      Effect.gen(function* () {
        yield* authenticateRawRouteWithScope(AuthOrchestrationOperateScope);
        const request = yield* HttpServerRequest.HttpServerRequest;
        const input = yield* request.json.pipe(
          Effect.mapError(
            () =>
              new Bootstrap.RealtimeBootstrapError({
                status: 400,
                message: "Invalid realtime request.",
              }),
          ),
        );
        return HttpServerResponse.jsonUnsafe(yield* bootstrap.create(input), { headers });
      }).pipe(
        Effect.catchTags({
          RealtimeBootstrapError: (error) =>
            Effect.succeed(
              HttpServerResponse.jsonUnsafe(
                { error: error.message },
                { status: error.status, headers },
              ),
            ),
          EnvironmentAuthInvalidError: HttpServerRespondable.toResponse,
          EnvironmentInternalError: HttpServerRespondable.toResponse,
          EnvironmentScopeRequiredError: HttpServerRespondable.toResponse,
        }),
        Effect.map((response) => HttpServerResponse.setHeaders(response, headers)),
      ),
    );
  }),
);
