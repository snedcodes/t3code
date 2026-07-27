import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { importOneSelectedThread, importSelectedThreads } from "./t3-selected-thread-import.mjs";

const makeTarget = (path) =>
  execFileSync("sqlite3", [
    path,
    `
CREATE TABLE effect_sql_migrations (id INTEGER PRIMARY KEY, name TEXT);
INSERT INTO effect_sql_migrations VALUES (33, 'current');
CREATE TABLE projection_projects (project_id TEXT PRIMARY KEY, title TEXT NOT NULL, workspace_root TEXT NOT NULL, default_model_selection_json TEXT, scripts_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT);
CREATE TABLE projection_threads (thread_id TEXT PRIMARY KEY, project_id TEXT NOT NULL, title TEXT NOT NULL, model_selection_json TEXT NOT NULL, runtime_mode TEXT NOT NULL, interaction_mode TEXT NOT NULL, branch TEXT, worktree_path TEXT, latest_turn_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, archived_at TEXT, settled_override TEXT, settled_at TEXT, latest_user_message_at TEXT, pending_approval_count INTEGER NOT NULL DEFAULT 0, pending_user_input_count INTEGER NOT NULL DEFAULT 0, has_actionable_proposed_plan INTEGER NOT NULL DEFAULT 0, deleted_at TEXT);
CREATE TABLE projection_thread_messages (message_id TEXT PRIMARY KEY, thread_id TEXT NOT NULL, turn_id TEXT, role TEXT NOT NULL, text TEXT NOT NULL, attachments_json TEXT, is_streaming INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE projection_thread_sessions (thread_id TEXT PRIMARY KEY, status TEXT NOT NULL, provider_name TEXT, provider_session_id TEXT, provider_thread_id TEXT, active_turn_id TEXT, last_error TEXT, updated_at TEXT NOT NULL);
CREATE TABLE projection_thread_activities (activity_id TEXT PRIMARY KEY, thread_id TEXT NOT NULL, payload_json TEXT NOT NULL);
CREATE TABLE orchestration_events (event_id TEXT PRIMARY KEY, thread_id TEXT NOT NULL, payload_json TEXT NOT NULL);
`,
  ]);

const query = (path, sql) =>
  JSON.parse(
    execFileSync("sqlite3", ["-readonly", "-json", path, sql], { encoding: "utf8" }) || "[]",
  );
const fixturePacket = () => ({
  format: "t3-selected-thread-export",
  formatVersion: 1,
  source: { path: "/tmp/copied-legacy.sqlite", sha256: "fixture-source-sha", migration: 33 },
  projects: [
    {
      legacyProjectId: "legacy-project",
      title: "Fixture Project",
      workspaceRoot: "/tmp/fixture",
      createdAt: "2026-07-27T00:00:00Z",
      updatedAt: "2026-07-27T00:00:00Z",
    },
  ],
  threads: [
    {
      project: {
        legacyProjectId: "legacy-project",
        title: "Fixture Project",
        workspaceRoot: "/tmp/fixture",
        createdAt: "2026-07-27T00:00:00Z",
        updatedAt: "2026-07-27T00:00:00Z",
      },
      thread: {
        legacyThreadId: "legacy-thread",
        title: "Fixture Agent",
        modelSelection: '{"provider":"codex","model":"gpt-5"}',
        runtimeMode: "full-access",
        interactionMode: "default",
        createdAt: "2026-07-27T00:01:00Z",
        updatedAt: "2026-07-27T00:02:00Z",
        dateRange: { first: "2026-07-27T00:03:00Z", last: "2026-07-27T00:04:00Z" },
        messages: [
          {
            legacyMessageId: "m1",
            threadId: "legacy-thread",
            turnId: null,
            role: "user",
            text: "hello",
            attachments: undefined,
            createdAt: "2026-07-27T00:03:00Z",
            updatedAt: "2026-07-27T00:03:00Z",
          },
          {
            legacyMessageId: "m2",
            threadId: "legacy-thread",
            turnId: "turn-1",
            role: "assistant",
            text: "world",
            attachments: [{ name: "a.txt" }],
            createdAt: "2026-07-27T00:04:00Z",
            updatedAt: "2026-07-27T00:04:00Z",
          },
        ],
      },
    },
  ],
});

describe("selected thread importer", () => {
  it("imports one settled native timeline transactionally and rejects repeat import", () => {
    const dir = mkdtempSync(join(tmpdir(), "t3-import-fixture-"));
    const target = join(dir, "state.sqlite");
    makeTarget(target);
    const packet = fixturePacket();
    const receipt = importOneSelectedThread({
      packet,
      targetPath: target,
      now: "2026-07-27T01:00:00Z",
    });
    expect(receipt.imported.messageCount).toBe(2);
    expect(query(target, "SELECT title, workspace_root FROM projection_projects")).toEqual([
      { title: "Fixture Project", workspace_root: "/tmp/fixture" },
    ]);
    expect(query(target, "SELECT title, settled_override FROM projection_threads")).toEqual([
      { title: "Fixture Agent", settled_override: "settled" },
    ]);
    expect(
      query(
        target,
        "SELECT role, text, attachments_json FROM projection_thread_messages ORDER BY created_at, message_id",
      ),
    ).toEqual([
      { role: "user", text: "hello", attachments_json: null },
      { role: "assistant", text: "world", attachments_json: '[{"name":"a.txt"}]' },
    ]);
    expect(query(target, "SELECT COUNT(*) AS n FROM projection_thread_activities")[0].n).toBe(0);
    expect(query(target, "SELECT COUNT(*) AS n FROM orchestration_events")[0].n).toBe(0);
    expect(
      query(
        target,
        "SELECT legacy_project_id, legacy_thread_id, source_sha256 FROM t3_selected_thread_imports",
      ),
    ).toEqual([
      {
        legacy_project_id: "legacy-project",
        legacy_thread_id: "legacy-thread",
        source_sha256: "fixture-source-sha",
      },
    ]);
    expect(() => importOneSelectedThread({ packet, targetPath: target })).toThrow(
      /target is non-empty/,
    );
  });

  it("imports exactly two threads in one project with per-thread provenance", () => {
    const dir = mkdtempSync(join(tmpdir(), "t3-import-two-fixture-"));
    const target = join(dir, "state.sqlite");
    const source = join(dir, "copied-source.sqlite");
    writeFileSync(source, "disposable copied source marker");
    const sourceHash = createHash("sha256").update(readFileSync(source)).digest("hex");
    makeTarget(target);
    const packet = fixturePacket();
    packet.source.sha256 = sourceHash;
    packet.threads.push({
      project: packet.threads[0].project,
      thread: {
        ...packet.threads[0].thread,
        legacyThreadId: "legacy-thread-2",
        title: "Second Fixture Agent",
        createdAt: "2026-07-27T00:05:00Z",
        updatedAt: "2026-07-27T00:06:00Z",
        dateRange: { first: "2026-07-27T00:07:00Z", last: "2026-07-27T00:08:00Z" },
        messages: packet.threads[0].thread.messages.map((message, index) => ({
          ...message,
          legacyMessageId: `m${index + 3}`,
          threadId: "legacy-thread-2",
          turnId: index === 0 ? null : "turn-2",
          text: index === 0 ? "second hello" : "second world",
          attachments: undefined,
          createdAt: `2026-07-27T00:0${7 + index}:00Z`,
          updatedAt: `2026-07-27T00:0${7 + index}:00Z`,
        })),
      },
    });
    const receipt = importSelectedThreads({
      packet,
      targetPath: target,
      now: "2026-07-27T01:00:00Z",
    });
    expect(receipt.imported).toEqual({ projectCount: 1, threadCount: 2, messageCount: 4 });
    expect(receipt.mapping.map((mapping) => mapping.legacyThreadId)).toEqual([
      "legacy-thread",
      "legacy-thread-2",
    ]);
    expect(query(target, "SELECT title, workspace_root FROM projection_projects")).toEqual([
      { title: "Fixture Project", workspace_root: "/tmp/fixture" },
    ]);
    expect(
      query(target, "SELECT title, settled_override FROM projection_threads ORDER BY created_at"),
    ).toEqual([
      { title: "Fixture Agent", settled_override: "settled" },
      { title: "Second Fixture Agent", settled_override: "settled" },
    ]);
    expect(
      query(
        target,
        "SELECT role, text FROM projection_thread_messages ORDER BY created_at, message_id",
      ),
    ).toEqual([
      { role: "user", text: "hello" },
      { role: "assistant", text: "world" },
      { role: "user", text: "second hello" },
      { role: "assistant", text: "second world" },
    ]);
    expect(
      query(
        target,
        "SELECT legacy_thread_id, message_count, source_sha256 FROM t3_selected_thread_imports ORDER BY legacy_thread_id",
      ),
    ).toEqual([
      { legacy_thread_id: "legacy-thread", message_count: 2, source_sha256: sourceHash },
      { legacy_thread_id: "legacy-thread-2", message_count: 2, source_sha256: sourceHash },
    ]);
    expect(query(target, "SELECT COUNT(*) AS n FROM projection_thread_activities")[0].n).toBe(0);
    expect(query(target, "SELECT COUNT(*) AS n FROM orchestration_events")[0].n).toBe(0);
    expect(query(target, "SELECT COUNT(*) AS n FROM projection_thread_sessions")[0].n).toBe(0);
    expect(createHash("sha256").update(readFileSync(source)).digest("hex")).toBe(sourceHash);
    expect(() => importSelectedThreads({ packet, targetPath: target })).toThrow(
      /target is non-empty/,
    );
  });
});
