import { describe, expect, it } from "@effect/vitest";
import {
  MessageId,
  OrchestrationThread,
  ProjectId,
  RealtimeClientSecretResponse,
  ThreadId,
  type OrchestrationProjectShell,
} from "@t3tools/contracts";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import * as TestClock from "effect/testing/TestClock";
import {
  HttpClient,
  HttpClientResponse,
  HttpServerRequest,
  HttpServerResponse,
} from "effect/unstable/http";
import type { HttpClientRequest } from "effect/unstable/http/HttpClientRequest";
import { realtimeBootstrapResponse } from "./bootstrap.ts";

const thread = Schema.decodeUnknownSync(OrchestrationThread)({
  id: "thread",
  projectId: "project",
  title: "Voice preparation",
  modelSelection: { provider: "codex", model: "gpt-5.4" },
  runtimeMode: "full-access",
  interactionMode: "default",
  branch: null,
  worktreePath: null,
  latestTurn: null,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T01:00:00.000Z",
  deletedAt: null,
  messages: [
    {
      id: "selected",
      role: "assistant",
      text: "Canonical selected response.",
      turnId: null,
      streaming: false,
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
    },
  ],
  activities: [],
  checkpoints: [],
  session: null,
});
const project: OrchestrationProjectShell = {
  id: ProjectId.make("project"),
  title: "Exact project",
  workspaceRoot: "/workspace",
  defaultModelSelection: null,
  scripts: [],
  createdAt: thread.createdAt,
  updatedAt: thread.updatedAt,
};
const decodeClientSecretResponse = Schema.decodeUnknownEffect(RealtimeClientSecretResponse);
const validBody = { projectId: "project", threadId: "thread", selectedMessageId: "selected" };
const upstreamSecret = {
  value: "ek_mock_only",
  expires_at: 2_000_000_000,
  session: { type: "realtime", model: "gpt-realtime-2.1", instructions: "not returned" },
  arbitrary: "not returned",
};

function harness(
  options: {
    project?: OrchestrationProjectShell | null;
    thread?: OrchestrationThread | null;
    key?: string | null;
    upstream?: Response;
    files?: Readonly<Record<string, string>>;
    canonicalPaths?: Readonly<Record<string, string>>;
    unreadable?: ReadonlyArray<string>;
  } = {},
) {
  const requests: HttpClientRequest[] = [];
  const reads: string[] = [];
  const fileReads: Array<{ path: string; limit: number }> = [];
  const files = options.files ?? {};
  const noop = FileSystem.makeNoop({});
  const fs = FileSystem.makeNoop({
    realPath: (value) => {
      const canonical = options.canonicalPaths?.[value];
      if (canonical !== undefined) return Effect.succeed(canonical);
      if (
        value === "/workspace" ||
        files[value] !== undefined ||
        Object.keys(files).some((key) => key.startsWith(`${value}/`))
      ) {
        return Effect.succeed(value);
      }
      return noop.realPath(value);
    },
    stat: (value) =>
      files[value] === undefined
        ? noop.stat(value)
        : Effect.succeed({
            type: "File",
            mtime: Option.none(),
            atime: Option.none(),
            birthtime: Option.none(),
            dev: 1,
            ino: Option.none(),
            mode: 0o644,
            nlink: Option.none(),
            uid: Option.none(),
            gid: Option.none(),
            rdev: Option.none(),
            size: FileSystem.Size(new TextEncoder().encode(files[value]).length),
            blksize: Option.none(),
            blocks: Option.none(),
          }),
    stream: (value, streamOptions) => {
      const limit = Number(streamOptions?.bytesToRead ?? 0);
      fileReads.push({ path: value, limit });
      if (options.unreadable?.includes(value)) return noop.stream(value);
      const bytes = new TextEncoder().encode(files[value] ?? "").subarray(0, limit);
      return Stream.fromIterable([bytes.subarray(0, 8), bytes.subarray(8)]);
    },
  });
  const query = {
    getProjectShellById: (id: ProjectId) => {
      reads.push(`project:${id}`);
      return Effect.succeed(
        Option.fromNullishOr(options.project === undefined ? project : options.project),
      );
    },
    getThreadDetailById: (id: ThreadId) => {
      reads.push(`thread:${id}`);
      return Effect.succeed(
        Option.fromNullishOr(options.thread === undefined ? thread : options.thread),
      );
    },
  };
  const client = HttpClient.make((request) =>
    Effect.sync(() => {
      requests.push(request);
      return HttpClientResponse.fromWeb(request, options.upstream ?? Response.json(upstreamSecret));
    }),
  );
  const run = (body: unknown = validBody, raw = false) =>
    realtimeBootstrapResponse(query).pipe(
      Effect.provideService(HttpClient.HttpClient, client),
      Effect.provideService(FileSystem.FileSystem, fs),
      Effect.provide(Path.layer),
      Effect.provideService(
        HttpServerRequest.HttpServerRequest,
        HttpServerRequest.fromWeb(
          new Request("https://environment.test/api/realtime/client-secrets", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: raw ? String(body) : JSON.stringify(body),
          }),
        ),
      ),
      Effect.provide(
        ConfigProvider.layer(
          ConfigProvider.fromUnknown(
            options.key === null ? {} : { OPENAI_API_KEY: options.key ?? "mock_server_key" },
          ),
        ),
      ),
      Effect.map(HttpServerResponse.toWeb),
    );
  return { requests, reads, fileReads, run };
}

describe("realtime bootstrap with injected HTTP only", () => {
  it.effect("mints exact canonical context and returns only the normalized client contract", () => {
    const h = harness();
    return Effect.gen(function* () {
      const response = yield* h.run();
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(h.reads).toEqual(["project:project", "thread:thread"]);
      expect(h.requests).toHaveLength(1);
      const request = h.requests[0]!;
      expect(request.url).toBe("https://api.openai.com/v1/realtime/client_secrets");
      expect(request.method).toBe("POST");
      expect(request.headers.authorization).toBe("Bearer mock_server_key");
      expect(request.body._tag).toBe("Uint8Array");
      if (request.body._tag !== "Uint8Array") throw new Error("Expected JSON request body");
      const body = JSON.parse(new TextDecoder().decode(request.body.body));
      expect(body.session).toMatchObject({
        type: "realtime",
        model: "gpt-realtime-2.1",
        audio: {
          input: { transcription: { model: "gpt-4o-mini-transcribe" } },
          output: { voice: "marin" },
        },
      });
      expect(body.session.instructions).toContain("Canonical selected response.");
      expect(body.session.instructions).toContain("Exact project");
      expect(body.session.tools).toBeUndefined();
      const payload: unknown = yield* Effect.promise(() => response.json());
      const decoded = yield* decodeClientSecretResponse(payload);
      expect(decoded).toMatchObject({
        clientSecret: "ek_mock_only",
        expiresAt: 2_000_000_000,
        model: "gpt-realtime-2.1",
        context: {
          projectId: "project",
          threadId: "thread",
          selectedMessageId: MessageId.make("selected"),
        },
      });
      expect(Object.keys(decoded).sort()).toEqual([
        "clientSecret",
        "context",
        "expiresAt",
        "model",
        "warnings",
      ]);
      expect(JSON.stringify(payload)).not.toContain("mock_server_key");
      expect(JSON.stringify(payload)).not.toContain("not returned");
    });
  });

  for (const [label, options] of [
    ["missing project", { project: null }],
    ["wrong project", { project: { ...project, id: ProjectId.make("other") } }],
    ["missing thread", { thread: null }],
    ["wrong thread", { thread: { ...thread, id: ThreadId.make("other") } }],
    ["thread in another project", { thread: { ...thread, projectId: ProjectId.make("other") } }],
    ["deleted thread", { thread: { ...thread, deletedAt: thread.updatedAt } }],
  ] as const) {
    it.effect(`rejects ${label} without minting or falling back`, () => {
      const h = harness(options);
      return Effect.gen(function* () {
        const response = yield* h.run();
        expect(response.status).toBe(404);
        expect(response.headers.get("cache-control")).toBe("no-store");
        expect(h.requests).toHaveLength(0);
      });
    });
  }

  for (const body of [
    { threadId: "thread" },
    { ...validBody, projectId: "" },
    { ...validBody, threadId: " thread " },
    { ...validBody, selectedMessageId: "absent" },
    { ...validBody, model: "unknown", instructions: "client override", tools: [] },
  ]) {
    it.effect(`rejects invalid selection/request ${JSON.stringify(body)} before minting`, () => {
      const h = harness();
      return Effect.gen(function* () {
        const response = yield* h.run(body);
        expect(response.status).toBe(400);
        expect(response.headers.get("cache-control")).toBe("no-store");
        expect(h.requests).toHaveLength(0);
      });
    });
  }

  it.effect("rejects malformed JSON before projection reads", () => {
    const h = harness();
    return Effect.gen(function* () {
      expect((yield* h.run("{", true)).status).toBe(400);
      expect(h.reads).toEqual([]);
      expect(h.requests).toHaveLength(0);
    });
  });

  it.effect("loads real selected Markdown snippets through canonical relative paths", () => {
    const h = harness({
      files: { "/workspace/docs/plan.md": "# Actual plan\n\nKeep TTS working." },
      canonicalPaths: { "/workspace/selected.md": "/workspace/docs/plan.md" },
    });
    return Effect.gen(function* () {
      const response = yield* h.run({
        ...validBody,
        documentPaths: ["selected.md", "docs/plan.md"],
      });
      expect(response.status).toBe(200);
      const payload = yield* Effect.promise(() => response.json()).pipe(
        Effect.flatMap(decodeClientSecretResponse),
      );
      expect(payload.context.documents).toEqual([
        {
          path: "docs/plan.md",
          title: "Actual plan",
          bytesIncluded: new TextEncoder().encode("# Actual plan\n\nKeep TTS working.").length,
          truncated: false,
        },
      ]);
      expect(h.fileReads).toHaveLength(1);
      const body = h.requests[0]!.body;
      if (body._tag !== "Uint8Array") throw new Error("Expected JSON request body");
      const instructions = JSON.parse(new TextDecoder().decode(body.body)).session.instructions;
      expect(instructions).toContain("Keep TTS working.");
      expect(instructions).toContain("Canonical selected response.");
      expect(instructions).not.toContain("/workspace");
      expect(payload.warnings.join(" ")).toContain("Portfolio Tasks have not been loaded");
    });
  });

  for (const selectedPath of [
    "../outside.md",
    "/outside.md",
    "C:\\private.md",
    "\\\\host\\secret.md",
    "docs/../outside.md",
    "notes.txt",
    "notes.md:stream",
  ]) {
    it.effect(`rejects unsafe document path ${selectedPath} before reading or minting`, () => {
      const h = harness();
      return Effect.gen(function* () {
        const response = yield* h.run({ ...validBody, documentPaths: [selectedPath] });
        expect(response.status).toBe(400);
        expect(response.headers.get("cache-control")).toBe("no-store");
        expect(h.fileReads).toEqual([]);
        expect(h.requests).toEqual([]);
      });
    });
  }

  for (const [label, canonicalPaths] of [
    ["symlink file escape", { "/workspace/link.md": "/outside/secret.md" }],
    ["missing leaf below escaping symlink", { "/workspace/link": "/outside" }],
    ["symlink to non-Markdown", { "/workspace/link.md": "/workspace/private.txt" }],
    ["similar-prefix sibling", { "/workspace/link.md": "/workspace-other/secret.md" }],
  ] as const) {
    it.effect(`rejects ${label} before content reads or minting`, () => {
      const h = harness({ canonicalPaths });
      return Effect.gen(function* () {
        const selectedPath =
          label === "missing leaf below escaping symlink" ? "link/missing.md" : "link.md";
        expect((yield* h.run({ ...validBody, documentPaths: [selectedPath] })).status).toBe(400);
        expect(h.fileReads).toEqual([]);
        expect(h.requests).toEqual([]);
      });
    });
  }

  it.effect(
    "warns about missing and unreadable selections without fabricating document context",
    () => {
      const h = harness({
        files: { "/workspace/unreadable.md": "hidden" },
        unreadable: ["/workspace/unreadable.md"],
      });
      return Effect.gen(function* () {
        const response = yield* h.run({
          ...validBody,
          documentPaths: ["missing.md", "unreadable.md"],
        });
        expect(response.status).toBe(200);
        const payload = yield* Effect.promise(() => response.json()).pipe(
          Effect.flatMap(decodeClientSecretResponse),
        );
        expect(payload.context.documents).toEqual([]);
        expect(payload.warnings.join(" ")).toContain("missing.md");
        expect(payload.warnings.join(" ")).toContain("unreadable.md");
        expect(JSON.stringify(payload)).not.toContain("hidden");
      });
    },
  );

  it.effect("clips to 16 KiB per file and 32 KiB total while retaining history", () => {
    const h = harness({
      files: {
        "/workspace/a.md": "a".repeat(20_000),
        "/workspace/b.md": "b".repeat(20_000),
        "/workspace/c.md": "must not be read",
      },
    });
    return Effect.gen(function* () {
      const response = yield* h.run({ ...validBody, documentPaths: ["a.md", "b.md", "c.md"] });
      expect(response.status).toBe(200);
      const payload = yield* Effect.promise(() => response.json()).pipe(
        Effect.flatMap(decodeClientSecretResponse),
      );
      expect(
        payload.context.documents.map((doc: { bytesIncluded: number }) => doc.bytesIncluded),
      ).toEqual([16384, 16384]);
      expect(payload.context.documents.every((doc: { truncated: boolean }) => doc.truncated)).toBe(
        true,
      );
      expect(payload.context.documentsTruncated).toBe(true);
      expect(payload.context.messageIds).toContain("selected");
      expect(payload.warnings.join(" ")).toContain("c.md");
      expect(h.fileReads.map((read) => read.limit)).toEqual([16384, 16384]);
    });
  });

  it.effect("rejects more than three selected documents before filesystem reads or mint", () => {
    const h = harness();
    return Effect.gen(function* () {
      expect(
        (yield* h.run({ ...validBody, documentPaths: ["a.md", "b.md", "c.md", "d.md"] })).status,
      ).toBe(400);
      expect(h.fileReads).toEqual([]);
      expect(h.requests).toEqual([]);
    });
  });

  it.effect("keeps multibyte Markdown within the byte cap without a replacement character", () => {
    const h = harness({ files: { "/workspace/unicode.md": "\u754c".repeat(10_000) } });
    return Effect.gen(function* () {
      const response = yield* h.run({ ...validBody, documentPaths: ["unicode.md"] });
      const payload = yield* Effect.promise(() => response.json()).pipe(
        Effect.flatMap(decodeClientSecretResponse),
      );
      expect(payload.context.documents).toEqual([
        {
          path: "unicode.md",
          title: "unicode.md",
          bytesIncluded: 16383,
          truncated: true,
        },
      ]);
      const body = h.requests[0]!.body;
      if (body._tag !== "Uint8Array") throw new Error("Expected JSON request body");
      const instructions = JSON.parse(new TextDecoder().decode(body.body)).session.instructions;
      expect(instructions).not.toContain("\uFFFD");
    });
  });

  for (const key of [null, "", "  "]) {
    it.effect(`returns safe unavailable for missing/blank key ${JSON.stringify(key)}`, () => {
      const h = harness({ key });
      return Effect.gen(function* () {
        const response = yield* h.run();
        expect(response.status).toBe(503);
        expect(response.headers.get("cache-control")).toBe("no-store");
        expect(h.requests).toHaveLength(0);
      });
    });
  }

  for (const [label, upstream] of [
    ["provider rejection", Response.json({ error: "private provider error" }, { status: 401 })],
    ["empty secret", Response.json({ ...upstreamSecret, value: "" })],
    ["invalid expiry type", Response.json({ ...upstreamSecret, expires_at: "wrong" })],
    ["expired secret", Response.json({ ...upstreamSecret, expires_at: 1 })],
    [
      "wrong session model",
      Response.json({ ...upstreamSecret, session: { type: "realtime", model: "wrong" } }),
    ],
    ["malformed JSON", new Response("not JSON")],
  ] as const) {
    it.effect(`normalizes ${label} without leaking its body`, () => {
      const h = harness({ upstream });
      return Effect.gen(function* () {
        // A positive, schema-valid expiry of 1 second is expired at this clock.
        yield* TestClock.setTime(2_000);
        const response = yield* h.run();
        expect(response.status).toBe(502);
        expect(response.headers.get("cache-control")).toBe("no-store");
        expect(yield* Effect.promise(() => response.json())).toEqual({
          error: "Realtime bootstrap failed.",
        });
      });
    });
  }
});
