import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  EXPECTED_SCHEMA_MIGRATION,
  inventoryCopiedDatabase,
} from "./t3-selected-thread-export.mjs";

const hash = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");

it("exports one native message timeline read-only and excludes operational history", () => {
  const dir = mkdtempSync(join(tmpdir(), "t3-export-fixture-"));
  const path = join(dir, "state.sqlite");
  const schema = `CREATE TABLE effect_sql_migrations (migration_id INTEGER PRIMARY KEY, created_at TEXT, name TEXT); INSERT INTO effect_sql_migrations VALUES (${EXPECTED_SCHEMA_MIGRATION}, '2026-07-27T00:00:00Z', 'current');
    CREATE TABLE projection_projects (project_id TEXT PRIMARY KEY, title TEXT, workspace_root TEXT, deleted_at TEXT, created_at TEXT, updated_at TEXT);
    CREATE TABLE projection_threads (thread_id TEXT PRIMARY KEY, project_id TEXT, title TEXT, model_selection_json TEXT, runtime_mode TEXT, interaction_mode TEXT, branch TEXT, worktree_path TEXT, archived_at TEXT, deleted_at TEXT, created_at TEXT, updated_at TEXT);
    CREATE TABLE projection_thread_messages (message_id TEXT PRIMARY KEY, thread_id TEXT, turn_id TEXT, role TEXT, text TEXT, attachments_json TEXT, is_streaming INTEGER, created_at TEXT, updated_at TEXT);
    CREATE TABLE projection_thread_activities (id TEXT); CREATE TABLE orchestration_events (id TEXT);
    INSERT INTO projection_projects VALUES ('p1', 'Fixture Project', '/tmp/fixture', NULL, '2026-07-27T00:00:00Z', '2026-07-27T00:00:00Z');
    INSERT INTO projection_threads VALUES ('t1', 'p1', 'Fixture Agent', '{"provider":"codex","model":"gpt-5"}', 'full-access', 'default', NULL, NULL, NULL, NULL, '2026-07-27T00:01:00Z', '2026-07-27T00:02:00Z');
    INSERT INTO projection_thread_messages VALUES ('m1', 't1', NULL, 'user', 'hello', NULL, 0, '2026-07-27T00:03:00Z', '2026-07-27T00:03:00Z');
    INSERT INTO projection_thread_messages VALUES ('m2', 't1', 'turn-1', 'assistant', 'world', '[{"name":"a.txt"}]', 0, '2026-07-27T00:04:00Z', '2026-07-27T00:04:00Z');`;
  execFileSync("sqlite3", [path, schema]);
  const before = hash(path);
  const result = inventoryCopiedDatabase({ sourcePath: path, threadIds: ["t1"] });
  expect(hash(path)).toBe(before);
  expect(result.threads[0].project.title).toBe("Fixture Project");
  expect(result.threads[0].thread.messages.map((m) => m.text)).toEqual(["hello", "world"]);
  expect(result.threads[0].thread.messages[1].attachments).toEqual([{ name: "a.txt" }]);
  expect(result.excludedTables).toEqual(["projection_thread_activities", "orchestration_events"]);
});

it("refuses a source with the wrong migration version", () => {
  const dir = mkdtempSync(join(tmpdir(), "t3-export-guard-"));
  const path = join(dir, "state.sqlite");
  execFileSync("sqlite3", [
    path,
    "CREATE TABLE effect_sql_migrations (migration_id INTEGER PRIMARY KEY, created_at TEXT, name TEXT); INSERT INTO effect_sql_migrations VALUES (32, '2026-07-27T00:00:00Z', 'old');",
  ]);
  expect(() => inventoryCopiedDatabase({ sourcePath: path })).toThrow(/Schema guard refused/);
});
