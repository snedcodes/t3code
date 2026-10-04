import { EnvironmentId, PortfolioContextReadRequest } from "@t3tools/contracts";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

const argumentsSchema = Schema.Struct({
  environmentId: Schema.optional(EnvironmentId),
  ...PortfolioContextReadRequest.fields,
});
const decodeArguments = Schema.decodeUnknownOption(argumentsSchema, { onExcessProperty: "error" });
const expectations: Record<keyof typeof argumentsSchema.fields, string> = {
  environmentId:
    "Omit to use the current environment, or supply an exact non-empty environment ID string.",
  operation:
    "Use list_projects, list_threads, read_thread, search_files, read_file or read_portfolio.",
  projectId: "Omit or supply an exact non-empty project ID string.",
  threadId: "Omit or supply an exact non-empty thread ID string.",
  query: "Omit or supply a string of at most 256 characters.",
  path: "Omit or supply a non-empty string of at most 4096 characters.",
  offset:
    "Omit or supply a non-negative safe integer; for continuation use the previous response's numeric nextOffset as offset. Stop when nextOffset is null.",
  limit: "Omit or supply an integer from 1 through 100.",
  maxChars: "Omit or supply an integer from 1 through 60000.",
};
const fieldDecoders = Object.entries(argumentsSchema.fields).map(([field, schema]) => ({
  field: field as keyof typeof argumentsSchema.fields,
  decode: Schema.decodeUnknownOption(Schema.Struct({ [field]: schema })),
}));

/** Return safe tool feedback rather than throwing into the transport's generic error boundary. */
export function createPortfolioContextToolRead(
  defaultEnvironmentId: EnvironmentId,
  read: (target: {
    environmentId: EnvironmentId;
    input: PortfolioContextReadRequest;
  }) => Promise<{ _tag: "Success"; value: unknown } | { _tag: "Failure" }>,
) {
  return async (input: Record<string, unknown>) => {
    const decoded = decodeArguments(input);
    if (Option.isNone(decoded)) {
      const invalidFields = fieldDecoders
        .filter(({ field, decode }) => Option.isNone(decode({ [field]: input[field] })))
        .map(({ field }) => ({ field, expected: expectations[field] }));
      return {
        error: {
          code: "invalid_arguments",
          message:
            "This context request was not sent. Correct the arguments and retry; this does not indicate that environments are unavailable. Omit unused optional fields instead of sending null.",
          invalidFields,
          ...(Object.keys(input).some((field) => !Object.hasOwn(argumentsSchema.fields, field))
            ? {
                allowedFields: Object.keys(argumentsSchema.fields),
                hint: "Remove unsupported fields. Send continuation as offset, not nextOffset.",
              }
            : {}),
        },
      };
    }
    const { environmentId, ...request } = decoded.value;
    try {
      const result = await read({
        environmentId: environmentId ?? defaultEnvironmentId,
        input: request,
      });
      if (result._tag === "Success") return result.value;
    } catch {
      // Never return provider, platform, auth or HTTP error details.
    }
    return {
      error: {
        code: "request_unavailable",
        message:
          "The requested environment could not complete this read. Check its connection and exact IDs using portfolio_context_sources; other environments may still be available.",
      },
    };
  };
}
