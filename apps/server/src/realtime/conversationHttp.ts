import {
  AuthOrchestrationOperateScope,
  RealtimeConversationOpenRequest,
  RealtimeConversationMessagesRequest,
} from "@t3tools/contracts";
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
import { RealtimeConversations, RealtimeConversationError } from "./conversations.ts";

const headers = { "cache-control": "no-store", pragma: "no-cache" };
const decodeOpen = Schema.decodeUnknownEffect(RealtimeConversationOpenRequest, {
  onExcessProperty: "error",
});
const decodeSave = Schema.decodeUnknownEffect(RealtimeConversationMessagesRequest, {
  onExcessProperty: "error",
});

export const realtimeConversationRouteLayer = Layer.unwrap(
  Effect.gen(function* () {
    const service = yield* RealtimeConversations;
    const response = (save: boolean) =>
      Effect.gen(function* () {
        yield* authenticateRawRouteWithScope(AuthOrchestrationOperateScope);
        const request = yield* HttpServerRequest.HttpServerRequest;
        const body = yield* request.json.pipe(
          Effect.mapError(
            () =>
              new RealtimeConversationError({
                status: 400,
                message: "Invalid voice conversation request.",
              }),
          ),
        );
        const result = save
          ? yield* decodeSave(body).pipe(
              Effect.mapError(
                () =>
                  new RealtimeConversationError({
                    status: 400,
                    message: "Invalid voice conversation request.",
                  }),
              ),
              Effect.flatMap(service.save),
            )
          : yield* decodeOpen(body).pipe(
              Effect.mapError(
                () =>
                  new RealtimeConversationError({
                    status: 400,
                    message: "Invalid voice conversation request.",
                  }),
              ),
              Effect.flatMap(service.open),
            );
        return HttpServerResponse.jsonUnsafe(result, { headers });
      }).pipe(
        Effect.catchTags({
          RealtimeConversationError: (error) =>
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
        Effect.map((result) => HttpServerResponse.setHeaders(result, headers)),
      );
    return Layer.mergeAll(
      HttpRouter.add("POST", "/api/realtime/conversations/open", response(false)),
      HttpRouter.add("POST", "/api/realtime/conversations/messages", response(true)),
    );
  }),
);
