import { describe, expect, it } from "@effect/vitest";
import {
  EnvironmentId,
  OrchestrationProjectShell,
  OrchestrationThread,
  PortfolioTask,
  PortfolioWishlist,
  ProjectId,
  ThreadId,
  type PortfolioContextReadRequest,
} from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import { ContextRead, makeContextRead } from "./ContextRead.ts";
import { contextReadResponse } from "./http.ts";
import { HttpServerRequest } from "effect/unstable/http";

const environmentId = EnvironmentId.make("local-environment");
const project = Schema.decodeUnknownSync(OrchestrationProjectShell)({
  id: "project",
  title: "Registered",
  workspaceRoot: "/workspace",
  defaultModelSelection: null,
  scripts: [],
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
});
const thread = Schema.decodeUnknownSync(OrchestrationThread)({
  id: "thread",
  projectId: "project",
  title: "All history",
  modelSelection: { provider: "codex", model: "gpt-5.4" },
  runtimeMode: "full-access",
  interactionMode: "default",
  branch: null,
  worktreePath: null,
  latestTurn: null,
  createdAt: project.createdAt,
  updatedAt: project.updatedAt,
  archivedAt: null,
  deletedAt: null,
  messages: Array.from({ length: 30 }, (_, i) => ({
    id: `message-${i}`,
    role: i % 2 ? "assistant" : "user",
    text: `History ${i} ${"x".repeat(100)} 🙂`,
    turnId: null,
    streaming: false,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  })),
  activities: [],
  checkpoints: [],
  session: null,
});
const task = Schema.decodeUnknownSync(PortfolioTask)({
  taskId: "task",
  title: "Canonical task",
  outcome: "Context access",
  target: { environmentId, projectId: project.id, threadId: thread.id },
  status: "in_progress",
  priority: "normal",
  ownerPassportId: null,
  ownerHost: "vps",
  checklistItems: [],
  completionCondition: "Readable",
  planLinks: [],
  evidenceLinks: [],
  createdAt: project.createdAt,
  updatedAt: project.updatedAt,
  completedAt: null,
  revision: 1,
  lastReceipt: null,
  heartbeatId: null,
});
const textOf = Schema.decodeUnknownSync(Schema.Struct({ text: Schema.String }));
const wishlist = Schema.decodeUnknownSync(PortfolioWishlist)({
  wishlistId: "wishlist",
  title: "Global idea",
  summary: "Environment-wide unassigned idea",
  status: "idea",
  priority: "normal",
  links: [],
  createdAt: project.createdAt,
  updatedAt: project.updatedAt,
  revision: 1,
  promotedTaskId: null,
});

function harness(
  options: {
    files?: Record<string, string>;
    links?: Record<string, string>;
    archived?: boolean;
    unavailable?: boolean;
  } = {},
) {
  const reads: string[] = [];
  const fileReads: Array<{ path: string; offset: number; length: number }> = [];
  const files = options.files ?? {};
  const noop = FileSystem.makeNoop({});
  const fs = FileSystem.makeNoop({
    realPath: (value) => {
      if (options.links?.[value]) return Effect.succeed(options.links[value]);
      if (
        value === "/workspace" ||
        value in files ||
        Object.keys(files).some((entry) => entry.startsWith(`${value}/`))
      )
        return Effect.succeed(value);
      return noop.realPath(value);
    },
    stat: (value) =>
      value in files
        ? Effect.succeed({
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
          })
        : noop.stat(value),
    stream: (value, input) => {
      const offset = Number(input?.offset ?? 0);
      const length = Number(input?.bytesToRead ?? 0);
      fileReads.push({ path: value, offset, length });
      const bytes = new TextEncoder().encode(files[value] ?? "").subarray(offset, offset + length);
      return Stream.fromIterable([bytes.subarray(0, 7), bytes.subarray(7)]);
    },
  });
  const detail = options.archived ? { ...thread, archivedAt: project.updatedAt } : thread;
  const snapshot = (archived: boolean) =>
    Effect.sync(() => {
      reads.push(archived ? "archived" : "active");
      return {
        projects: [project],
        threads:
          options.archived === archived
            ? [
                {
                  ...detail,
                  latestUserMessageAt: null,
                  hasPendingApprovals: false,
                  hasPendingUserInput: false,
                  hasActionableProposedPlan: false,
                },
              ]
            : [],
        snapshotSequence: 7,
        updatedAt: project.updatedAt,
      };
    });
  const make = makeContextRead({
    snapshots: {
      getProjectShells: () =>
        Effect.sync(() => {
          reads.push("projects");
          return [project];
        }),
      getProjectShellById: (id) =>
        Effect.sync(() => {
          reads.push(`project:${id}`);
          return id === project.id ? Option.some(project) : Option.none();
        }),
      getShellSnapshot: () => snapshot(false),
      getArchivedShellSnapshot: () => snapshot(true),
      getThreadDetailSnapshot: (id, options) =>
        Effect.sync(() => {
          expect(options?.includeArchived).toBe(true);
          reads.push(`thread:${id}`);
          return id === detail.id
            ? Option.some({ thread: detail, snapshotSequence: 7 })
            : Option.none();
        }),
    },
    portfolio: {
      environmentId,
      readTasks: Effect.succeed({ ownerEnvironmentId: environmentId, tasks: [task] }),
      readHeartbeats: Effect.succeed({ ownerEnvironmentId: environmentId, heartbeats: [] }),
      readWishlists: Effect.succeed({ ownerEnvironmentId: environmentId, wishlists: [wishlist] }),
    },
    workspace: {
      list: () =>
        Effect.sync(() => {
          reads.push("workspace");
          return {
            entries: [
              { path: "docs/readme.md", kind: "file" as const },
              { path: "src/app.ts", kind: "file" as const },
            ],
            truncated: false,
          };
        }),
    },
  });
  const run = (input: PortfolioContextReadRequest) =>
    Effect.flatMap(make, (service) => service.read(input)).pipe(
      Effect.provideService(FileSystem.FileSystem, fs),
      Effect.provide(Path.layer),
    );
  const http = (body: string) =>
    Effect.flatMap(make, (service) =>
      contextReadResponse.pipe(Effect.provideService(ContextRead, service)),
    ).pipe(
      Effect.provideService(FileSystem.FileSystem, fs),
      Effect.provide(Path.layer),
      Effect.provideService(
        HttpServerRequest.HttpServerRequest,
        HttpServerRequest.fromWeb(
          new Request("https://environment.test/api/context/read", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body,
          }),
        ),
      ),
    );
  return { make, run, http, fs, reads, fileReads };
}

describe("ContextRead", () => {
  it.effect("constructs without eager canonical or filesystem reads", () =>
    Effect.gen(function* () {
      const h = harness();
      yield* h.make.pipe(
        Effect.provideService(FileSystem.FileSystem, h.fs),
        Effect.provide(Path.layer),
      );
      expect(h.reads).toEqual([]);
      expect(h.fileReads).toEqual([]);
    }),
  );
  it.effect("inventories exact registered projects and archived thread metadata", () =>
    Effect.gen(function* () {
      const h = harness({ archived: true });
      expect((yield* h.run({ operation: "list_projects" })).data).toMatchObject({
        items: [{ id: project.id, workspaceRoot: "/workspace" }],
      });
      expect((yield* h.run({ operation: "list_threads" })).data).toMatchObject({
        items: [{ id: thread.id, archivedAt: project.updatedAt }],
      });
      expect(h.reads).not.toContain(`thread:${thread.id}`);
    }),
  );
  it.effect("continues through every canonical history message including archived history", () =>
    Effect.gen(function* () {
      const h = harness({ archived: true });
      let offset = 0;
      let content = "";
      while (true) {
        const result = yield* h.run({
          operation: "read_thread",
          threadId: thread.id,
          maxChars: 257,
          offset,
        });
        content += textOf(result.data).text;
        if (result.nextOffset === null) {
          expect(result.truncated).toBe(false);
          break;
        }
        expect(result.nextOffset).toBeGreaterThan(offset);
        offset = result.nextOffset;
      }
      expect(JSON.parse(content)).toEqual({ ...thread, archivedAt: project.updatedAt });
    }),
  );
  it.effect("rejects wrong project/thread and never falls back", () =>
    Effect.gen(function* () {
      const h = harness();
      const error = yield* h
        .run({ operation: "read_thread", projectId: ProjectId.make("other"), threadId: thread.id })
        .pipe(Effect.flip);
      expect(error.status).toBe(404);
      expect(
        (yield* h
          .run({ operation: "read_thread", threadId: ThreadId.make("missing") })
          .pipe(Effect.flip)).status,
      ).toBe(404);
    }),
  );
  it.effect("pages inventory and filters registered workspace paths", () =>
    Effect.gen(function* () {
      const h = harness();
      const first = yield* h.run({ operation: "search_files", projectId: project.id, limit: 1 });
      expect(first.nextOffset).toBe(1);
      expect(
        (yield* h.run({
          operation: "search_files",
          projectId: project.id,
          offset: first.nextOffset!,
          limit: 1,
        })).nextOffset,
      ).toBeNull();
      expect(
        (yield* h.run({ operation: "search_files", projectId: project.id, query: "README" })).data,
      ).toMatchObject({ items: [{ path: "docs/readme.md" }] });
    }),
  );
  it.effect("reads unlimited successive UTF-8 file chunks without full-file loading", () =>
    Effect.gen(function* () {
      const original = "🙂 café\n".repeat(10000);
      const h = harness({ files: { "/workspace/large.txt": original } });
      let offset = 0;
      let output = "";
      while (true) {
        const result = yield* h.run({
          operation: "read_file",
          projectId: project.id,
          path: "large.txt",
          offset,
          maxChars: 4000,
        });
        output += textOf(result.data).text;
        if (result.nextOffset === null) break;
        expect(result.nextOffset).toBeGreaterThan(offset);
        offset = result.nextOffset;
      }
      expect(output).toBe(original);
      expect(h.fileReads.every((read) => read.length === 16004)).toBe(true);
      expect(h.fileReads.at(-1)?.offset).toBeGreaterThan(32000);
    }),
  );
  for (const path of [
    "../outside",
    "/etc/file",
    "C:\\secret",
    "\\\\host\\file",
    "docs/../file",
    "file:stream",
    "./file",
  ]) {
    it.effect(`rejects path ${JSON.stringify(path)} before content reads`, () =>
      Effect.gen(function* () {
        const h = harness();
        expect(
          (yield* h.run({ operation: "read_file", projectId: project.id, path }).pipe(Effect.flip))
            .status,
        ).toBe(400);
        expect(h.fileReads).toEqual([]);
      }),
    );
  }
  it.effect("rejects escaping symlink and missing leaf beneath escaping symlink", () =>
    Effect.gen(function* () {
      const h = harness({
        links: { "/workspace/link": "/outside", "/workspace/link/exists": "/outside/exists" },
      });
      for (const path of ["link/exists", "link/missing"])
        expect(
          (yield* h.run({ operation: "read_file", projectId: project.id, path }).pipe(Effect.flip))
            .status,
        ).toBe(400);
      expect(h.fileReads).toEqual([]);
    }),
  );
  it.effect("returns missing file explicitly and canonical relative path for internal alias", () =>
    Effect.gen(function* () {
      const h = harness({
        files: { "/workspace/docs/file": "actual source" },
        links: { "/workspace/alias": "/workspace/docs/file" },
      });
      expect(
        (yield* h
          .run({ operation: "read_file", projectId: project.id, path: "missing" })
          .pipe(Effect.flip)).status,
      ).toBe(404);
      expect(
        (yield* h.run({ operation: "read_file", projectId: project.id, path: "alias" })).data,
      ).toMatchObject({ path: "docs/file", text: "actual source" });
    }),
  );
  it.effect("returns canonical portfolio owner records without mutations", () =>
    Effect.gen(function* () {
      const result = yield* harness().run({ operation: "read_portfolio" });
      expect(result.environmentId).toBe(environmentId);
      expect(result.data).toEqual({
        globalWishlistsIncluded: true,
        items: [
          { kind: "task", value: task },
          { kind: "wishlist", scope: "environment", value: wishlist },
        ],
      });
      const filtered = yield* harness().run({
        operation: "read_portfolio",
        projectId: project.id,
        threadId: ThreadId.make("unrelated"),
      });
      expect(filtered.data).toEqual({
        globalWishlistsIncluded: true,
        items: [{ kind: "wishlist", scope: "environment", value: wishlist }],
      });
    }),
  );
  it.effect("returns no-store HTTP success and safe malformed/path failures", () =>
    Effect.gen(function* () {
      const h = harness();
      const success = yield* h.http(JSON.stringify({ operation: "list_projects" }));
      expect(success.status).toBe(200);
      expect(success.headers["cache-control"]).toBe("no-store");
      for (const body of [
        "{",
        JSON.stringify({ operation: "read_file", projectId: project.id, path: "../outside" }),
        JSON.stringify({ operation: "list_projects", unknown: "value" }),
      ]) {
        const result = yield* h.http(body);
        expect(result.status).toBe(400);
        expect(result.headers["cache-control"]).toBe("no-store");
      }
    }),
  );
});
