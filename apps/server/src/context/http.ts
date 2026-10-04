import { AuthOrchestrationOperateScope, PortfolioContextReadRequest } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import {
  HttpRouter,
  HttpServerRequest,
  HttpServerRespondable,
  HttpServerResponse,
} from "effect/unstable/http";
import { authenticateRawRouteWithScope } from "../http.ts";
import { ContextRead, ContextReadError } from "./ContextRead.ts";

const headers = { "cache-control": "no-store", pragma: "no-cache" };
export const contextReadResponse = Effect.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest;
  const service = yield* ContextRead;
  const input = yield* request.json.pipe(
    Effect.flatMap(
      Schema.decodeUnknownEffect(PortfolioContextReadRequest, { onExcessProperty: "error" }),
    ),
    Effect.mapError(
      () => new ContextReadError({ status: 400, message: "Invalid context request." }),
    ),
  );
  return HttpServerResponse.jsonUnsafe(yield* service.read(input), { headers });
}).pipe(
  Effect.catchTag("ContextReadError", (error) =>
    Effect.succeed(
      HttpServerResponse.jsonUnsafe({ error: error.message }, { status: error.status, headers }),
    ),
  ),
);

export const contextReadRouteLayer = Layer.unwrap(
  Effect.gen(function* () {
    const service = yield* ContextRead;
    return HttpRouter.add(
      "POST",
      "/api/context/read",
      Effect.gen(function* () {
        yield* authenticateRawRouteWithScope(AuthOrchestrationOperateScope);
        return yield* contextReadResponse.pipe(Effect.provideService(ContextRead, service));
      }).pipe(
        Effect.catchTags({
          EnvironmentAuthInvalidError: HttpServerRespondable.toResponse,
          EnvironmentInternalError: HttpServerRespondable.toResponse,
          EnvironmentScopeRequiredError: HttpServerRespondable.toResponse,
        }),
        Effect.map((response) => HttpServerResponse.setHeaders(response, headers)),
      ),
    );
  }),
);
