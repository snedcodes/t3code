import {
  PortfolioContextReadRequest,
  PortfolioContextReadResponse,
  OrchestrationThread,
  type EnvironmentId,
  type ProjectId,
} from "@t3tools/contracts";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import { ProjectionSnapshotQuery } from "../orchestration/Services/ProjectionSnapshotQuery.ts";
import * as ServerEnvironment from "../environment/ServerEnvironment.ts";
import { WorkspaceEntries } from "../workspace/WorkspaceEntries.ts";

export class ContextReadError extends Schema.TaggedError<ContextReadError>()("ContextReadError", {
  status: Schema.Literals([400, 404, 503]),
  message: Schema.String,
}) {}

export class ContextRead extends Context.Service<
  ContextRead,
  {
    readonly environmentId: EnvironmentId;
    readonly read: (
      input: PortfolioContextReadRequest,
    ) => Effect.Effect<PortfolioContextReadResponse, ContextReadError>;
  }
>()("t3/context/ContextRead") {}

const failure = (status: 400 | 404 | 503, message: string) =>
  new ContextReadError({ status, message });
const unavailable = () => failure(503, "Context source unavailable.");
const decodeRequest = Schema.decodeUnknownEffect(PortfolioContextReadRequest, {
  onExcessProperty: "error",
});
const decodeJson = Schema.decodeUnknownEffect(Schema.Json);
const encodeThread = Schema.encodeEffect(Schema.fromJsonString(OrchestrationThread));

/** Registration is cheap. Canonical sources and filesystem are read only on invocation. */
const make = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const snapshots = yield* ProjectionSnapshotQuery;
  const environmentId = yield* (yield* ServerEnvironment.ServerEnvironment).getEnvironmentId;
  const workspace = yield* WorkspaceEntries;
  const project = (id: ProjectId | undefined) =>
    Effect.gen(function* () {
      if (!id) return yield* failure(400, "projectId is required.");
      const result = yield* snapshots.getProjectShellById(id).pipe(Effect.mapError(unavailable));
      if (Option.isNone(result) || result.value.id !== id)
        return yield* failure(404, "Project not found.");
      return result.value;
    });
  const canonicalFile = (root: string, selected: string | undefined) =>
    Effect.gen(function* () {
      if (!selected) return yield* failure(400, "path is required.");
      const relative = selected.replace(/\\/g, "/");
      if (
        relative.trim() !== relative ||
        /[:\p{Cc}]/u.test(relative) ||
        path.isAbsolute(relative) ||
        relative.startsWith("/") ||
        relative.split("/").some((part) => !part || part === "." || part === "..")
      ) {
        return yield* failure(400, "Invalid project-relative path.");
      }
      const canonicalRoot = yield* fs.realPath(root).pipe(Effect.mapError(unavailable));
      const contained = (target: string) => {
        const value = path.relative(canonicalRoot, target);
        return value !== ".." && !value.startsWith(`..${path.sep}`) && !path.isAbsolute(value);
      };
      const candidate = path.resolve(canonicalRoot, relative);
      if (!contained(candidate)) return yield* failure(400, "Path outside project.");
      const canonical = yield* fs.realPath(candidate).pipe(Effect.option);
      if (Option.isNone(canonical)) {
        // Even a missing leaf under an escaping symlink is an invalid path.
        let parent = path.dirname(candidate);
        while (contained(parent)) {
          const resolved = yield* fs.realPath(parent).pipe(Effect.option);
          if (Option.isSome(resolved)) {
            if (!contained(resolved.value)) return yield* failure(400, "Path outside project.");
            break;
          }
          const next = path.dirname(parent);
          if (next === parent) break;
          parent = next;
        }
        return yield* failure(404, "File unavailable.");
      }
      if (!contained(canonical.value)) return yield* failure(400, "Path outside project.");
      return {
        absolute: canonical.value,
        relative: path.relative(canonicalRoot, canonical.value).split(path.sep).join("/"),
      };
    });
  const read = Effect.fn("ContextRead.read")(function* (request: PortfolioContextReadRequest) {
    const input = yield* decodeRequest(request).pipe(
      Effect.mapError(() => failure(400, "Invalid context request.")),
    );
    const offset = input.offset ?? 0;
    const limit = input.limit ?? 50;
    const maxChars = input.maxChars ?? 16000;
    const response = (
      data: Schema.Json,
      nextOffset: number | null,
      truncated = nextOffset !== null,
    ): PortfolioContextReadResponse => ({
      environmentId,
      operation: input.operation,
      data,
      nextOffset,
      truncated,
    });
    const page = (items: ReadonlyArray<Schema.Json>, extra: Schema.JsonObject = {}) => {
      const selected = items.slice(offset, offset + limit);
      const next = offset + selected.length < items.length ? offset + selected.length : null;
      return response({ ...extra, items: selected }, next);
    };
    // Decode copies only JSON-safe canonical fields; no arbitrary runtime object crosses the wire.
    const json = (value: unknown) => decodeJson(value).pipe(Effect.mapError(unavailable));
    switch (input.operation) {
      case "list_projects": {
        const projects = yield* snapshots.getProjectShells().pipe(Effect.mapError(unavailable));
        return page(
          projects
            .toSorted((a, b) => a.id.localeCompare(b.id))
            .map((p) => ({
              id: p.id,
              title: p.title,
              workspaceRoot: p.workspaceRoot,
              createdAt: p.createdAt,
              updatedAt: p.updatedAt,
            })),
        );
      }
      case "list_threads": {
        if (input.projectId) yield* project(input.projectId);
        const active = yield* snapshots.getShellSnapshot().pipe(Effect.mapError(unavailable));
        const archived = yield* snapshots
          .getArchivedShellSnapshot()
          .pipe(Effect.mapError(unavailable));
        const threads = [
          ...new Map([...active.threads, ...archived.threads].map((t) => [t.id, t])).values(),
        ]
          .filter((t) => !input.projectId || t.projectId === input.projectId)
          .toSorted((a, b) => a.id.localeCompare(b.id));
        return page(
          yield* Effect.forEach(threads, (t) =>
            Effect.gen(function* () {
              return {
                id: t.id,
                projectId: t.projectId,
                title: t.title,
                createdAt: t.createdAt,
                updatedAt: t.updatedAt,
                archivedAt: t.archivedAt,
                latestTurn: yield* json(t.latestTurn),
              };
            }),
          ),
        );
      }
      case "read_thread": {
        if (!input.threadId) return yield* failure(400, "threadId is required.");
        const snapshot = yield* snapshots
          .getThreadDetailSnapshot(input.threadId, undefined, { includeArchived: true })
          .pipe(Effect.mapError(unavailable));
        if (
          Option.isNone(snapshot) ||
          snapshot.value.thread.id !== input.threadId ||
          snapshot.value.thread.deletedAt !== null ||
          (input.projectId && snapshot.value.thread.projectId !== input.projectId)
        )
          return yield* failure(404, "Thread not found.");
        const { thread, snapshotSequence } = snapshot.value;
        yield* project(thread.projectId);
        const text = yield* encodeThread(thread).pipe(Effect.mapError(unavailable));
        let end = Math.min(text.length, offset + maxChars);
        // Keep surrogate pairs intact, while retaining exact UTF-16 continuation offsets.
        if (end < text.length && /[\uD800-\uDBFF]/u.test(text.charAt(end - 1))) end--;
        if (end === offset && end < text.length) end = Math.min(text.length, end + 2);
        return response(
          {
            projectId: thread.projectId,
            threadId: thread.id,
            snapshotSequence,
            threadUpdatedAt: thread.updatedAt,
            format: "canonical-thread-json",
            offsetUnit: "utf16-character",
            offset,
            text: text.slice(offset, end),
          },
          end < text.length ? end : null,
        );
      }
      case "search_files": {
        const p = yield* project(input.projectId);
        const result = yield* workspace
          .list({ cwd: p.workspaceRoot })
          .pipe(Effect.mapError(unavailable));
        const query = (input.query ?? "").toLowerCase();
        const items = result.entries
          .filter((entry) => entry.kind === "file" && entry.path.toLowerCase().includes(query))
          .toSorted((a, b) => a.path.localeCompare(b.path));
        const output = page(
          items.map((entry) => ({ path: entry.path, kind: entry.kind })),
          { projectId: p.id, indexTruncated: result.truncated },
        );
        return { ...output, truncated: output.truncated || result.truncated };
      }
      case "read_file": {
        const p = yield* project(input.projectId);
        const file = yield* canonicalFile(p.workspaceRoot, input.path);
        const info = yield* fs.stat(file.absolute).pipe(Effect.mapError(unavailable));
        if (info.type !== "File") return yield* failure(400, "Path is not a regular file.");
        // Offset is bytes. Each page reads at most maxChars*4+4, never the entire file.
        const bytes = yield* fs
          .stream(file.absolute, {
            offset,
            bytesToRead: maxChars * 4 + 4,
            chunkSize: maxChars * 4 + 4,
          })
          .pipe(
            Stream.runFold(
              () => new Uint8Array(0),
              (previous, chunk) => {
                const next = new Uint8Array(previous.length + chunk.length);
                next.set(previous);
                next.set(chunk, previous.length);
                return next;
              },
            ),
            Effect.mapError(unavailable),
          );
        const hasMoreBytes = info.size > BigInt(offset + bytes.length);
        const decoded = yield* Effect.try(() =>
          new TextDecoder("utf-8", { fatal: true }).decode(bytes, { stream: hasMoreBytes }),
        ).pipe(
          Effect.mapError(() =>
            failure(400, "File is not valid UTF-8 text or offset is not a character boundary."),
          ),
        );
        if (decoded.includes("\0")) return yield* failure(400, "File is not UTF-8 text.");
        let end = Math.min(decoded.length, maxChars);
        if (end < decoded.length && /[\uD800-\uDBFF]/u.test(decoded.charAt(end - 1))) end--;
        if (end === 0 && decoded.length > 0) end = Math.min(decoded.length, 2);
        const text = decoded.slice(0, end);
        const next = offset + new TextEncoder().encode(text).length;
        return response(
          { projectId: p.id, path: file.relative, offset, offsetUnit: "utf8-byte", text },
          BigInt(next) < info.size ? next : null,
        );
      }
      case "read_portfolio": {
        return yield* failure(
          503,
          "read_portfolio is unsupported: this release has no canonical Portfolio owner.",
        );
      }
    }
  });
  return ContextRead.of({ read, environmentId });
});

export const layer = Layer.effect(ContextRead, make);
