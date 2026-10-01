import type { RealtimeDocumentProvenance } from "@t3tools/contracts";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as Stream from "effect/Stream";

const MAX_FILE_BYTES = 16 * 1024;
const MAX_TOTAL_BYTES = 32 * 1024;
export type RealtimeDocumentSnippet = RealtimeDocumentProvenance & { readonly text: string };

export class RealtimeDocumentPathError extends Data.TaggedError("RealtimeDocumentPathError") {}

/** Reads only explicitly selected, canonically contained Markdown snippets. */
export const loadRealtimeDocuments = Effect.fn("realtime.loadDocuments")(function* (
  workspaceRoot: string,
  documentPaths: ReadonlyArray<string>,
) {
  const documents: RealtimeDocumentSnippet[] = [];
  const warnings: string[] = [];
  let truncated = false;
  if (documentPaths.length === 0) return { documents, warnings, truncated };
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  if (documentPaths.length > 3) return yield* new RealtimeDocumentPathError();
  // Reject traversal and Windows drive/UNC/ADS forms even on a POSIX host.
  const selectedPaths = documentPaths.map((value) => value.replace(/\\/g, "/"));
  for (const value of selectedPaths) {
    if (
      value.trim() !== value ||
      /[:\p{Cc}]/u.test(value) ||
      path.isAbsolute(value) ||
      value.startsWith("/") ||
      value.split("/").some((part) => !part || part === "." || part === "..") ||
      path.extname(value).toLowerCase() !== ".md"
    )
      return yield* new RealtimeDocumentPathError();
  }
  const root = yield* fs.realPath(workspaceRoot).pipe(Effect.option);
  if (Option.isNone(root)) {
    for (const value of selectedPaths)
      warnings.push(`Document unavailable: ${value} (project root unreadable).`);
    return { documents, warnings, truncated };
  }
  const withinRoot = (target: string) => {
    const relative = path.relative(root.value, target);
    return relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
  };
  const canonicalPaths: Array<{ selected: string; canonical: string | null }> = [];
  // Validate every selected path before reading any document content.
  for (const selected of selectedPaths) {
    const candidate = path.resolve(root.value, selected);
    if (!withinRoot(candidate)) return yield* new RealtimeDocumentPathError();
    const canonical = yield* fs.realPath(candidate).pipe(Effect.option);
    if (Option.isSome(canonical)) {
      if (!withinRoot(canonical.value) || path.extname(canonical.value).toLowerCase() !== ".md") {
        return yield* new RealtimeDocumentPathError();
      }
      canonicalPaths.push({ selected, canonical: canonical.value });
    } else {
      // A missing leaf may still be below a symlink that escapes the project.
      let parent = path.dirname(candidate);
      while (withinRoot(parent)) {
        const resolvedParent = yield* fs.realPath(parent).pipe(Effect.option);
        if (Option.isSome(resolvedParent)) {
          if (!withinRoot(resolvedParent.value)) return yield* new RealtimeDocumentPathError();
          break;
        }
        const next = path.dirname(parent);
        if (next === parent) break;
        parent = next;
      }
      canonicalPaths.push({ selected, canonical: null });
    }
  }
  let remaining = MAX_TOTAL_BYTES;
  const seen = new Set<string>();
  for (const entry of canonicalPaths) {
    if (entry.canonical === null) {
      warnings.push(`Document unavailable: ${entry.selected} (missing or unreadable).`);
      continue;
    }
    const canonical = entry.canonical;
    if (seen.has(canonical)) continue;
    seen.add(canonical);
    const relative = path.relative(root.value, canonical).split(path.sep).join("/");
    if (remaining === 0) {
      truncated = true;
      warnings.push(`Document omitted: ${relative} (32 KiB document budget reached).`);
      continue;
    }
    const limit = Math.min(MAX_FILE_BYTES, remaining);
    const content = yield* Effect.gen(function* () {
      const info = yield* fs.stat(canonical);
      if (info.type !== "File") return null;
      const bytes = yield* fs
        .stream(canonical, { bytesToRead: limit, chunkSize: limit, bufferSize: 1 })
        .pipe(
          Stream.runFold(
            () => new Uint8Array(0),
            (bytes, chunk) => {
              const next = new Uint8Array(bytes.length + chunk.length);
              next.set(bytes);
              next.set(chunk, bytes.length);
              return next;
            },
          ),
        );
      return { bytes, clipped: info.size > BigInt(limit) };
    }).pipe(Effect.orElseSucceed(() => null));
    if (content === null) {
      warnings.push(
        `Document unavailable: ${relative} (missing, unreadable or not a regular file).`,
      );
      continue;
    }
    const { bytes, clipped } = content;
    remaining -= bytes.length;
    // Streaming decode omits a partial UTF-8 character at a clipped boundary.
    const decoded = yield* Effect.try(() =>
      new TextDecoder("utf-8", { fatal: true }).decode(bytes, { stream: clipped }),
    ).pipe(Effect.option);
    if (Option.isNone(decoded)) {
      warnings.push(`Document unavailable: ${relative} (invalid UTF-8).`);
      continue;
    }
    const text = decoded.value;
    const bytesIncluded = new TextEncoder().encode(text).length;
    const title = /^#\s+(.+)$/m.exec(text)?.[1]?.trim().slice(0, 240) || path.basename(relative);
    documents.push({ path: relative, title, text, bytesIncluded, truncated: clipped });
    truncated ||= clipped;
    if (clipped) warnings.push(`Document clipped: ${relative} (bounded Markdown snippet).`);
  }
  return { documents, warnings, truncated };
});
