#!/usr/bin/env node

import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { EXPECTED_SCHEMA_MIGRATION } from "./t3-selected-thread-export.mjs";

const EXCLUDED_CATEGORIES = [
  "projection_thread_activities",
  "orchestration_events",
  "tool-completed payloads",
  "provider runtime state",
];
const sql = (value) =>
  value === null || value === undefined ? "NULL" : `'${String(value).replaceAll("'", "''")}'`;
const query = (path, statement) =>
  JSON.parse(
    execFileSync("sqlite3", ["-readonly", "-json", path, statement], { encoding: "utf8" }) || "[]",
  );
const run = (path, statement) => execFileSync("sqlite3", [path, statement], { encoding: "utf8" });

const requiredColumns = {
  projection_projects: [
    "project_id",
    "title",
    "workspace_root",
    "scripts_json",
    "created_at",
    "updated_at",
  ],
  projection_threads: [
    "thread_id",
    "project_id",
    "title",
    "model_selection_json",
    "runtime_mode",
    "interaction_mode",
    "created_at",
    "updated_at",
    "settled_override",
    "settled_at",
  ],
  projection_thread_messages: [
    "message_id",
    "thread_id",
    "turn_id",
    "role",
    "text",
    "attachments_json",
    "is_streaming",
    "created_at",
    "updated_at",
  ],
};

export function importOneSelectedThread({ packet, targetPath, now = new Date().toISOString() }) {
  if (packet?.format !== "t3-selected-thread-export" || packet.formatVersion !== 1)
    throw new Error("Import refused: unsupported export packet");
  if (packet.source?.migration !== EXPECTED_SCHEMA_MIGRATION)
    throw new Error(`Import refused: source migration must be ${EXPECTED_SCHEMA_MIGRATION}`);
  if (!packet.source?.sha256 || typeof packet.source.sha256 !== "string")
    throw new Error("Import refused: packet has no source SHA-256");
  if (!Array.isArray(packet.threads) || packet.threads.length !== 1)
    throw new Error("Import refused: exactly one selected thread is required");
  const { project, thread } = packet.threads[0];
  if (!project?.legacyProjectId || !thread?.legacyThreadId || !Array.isArray(thread.messages))
    throw new Error("Import refused: incomplete selected thread packet");
  if (
    targetPath.includes("/.t3/") ||
    targetPath.endsWith("/.t3/userdata/state.sqlite") ||
    targetPath.includes("T3-state-backup-2026-07-27.sqlite")
  )
    throw new Error("Import refused: production or backup target path");
  const tables = new Set(
    query(targetPath, "SELECT name FROM sqlite_master WHERE type = 'table'").map((r) => r.name),
  );
  const missingTables = Object.keys(requiredColumns).filter((name) => !tables.has(name));
  if (missingTables.length)
    throw new Error(`Import refused: target missing ${missingTables.join(", ")}`);
  const migration =
    query(targetPath, "SELECT COALESCE(MAX(id), 0) AS id FROM effect_sql_migrations")[0]?.id ?? 0;
  if (Number(migration) !== EXPECTED_SCHEMA_MIGRATION)
    throw new Error(
      `Import refused: target migration must be ${EXPECTED_SCHEMA_MIGRATION}, found ${migration}`,
    );
  for (const [table, columns] of Object.entries(requiredColumns)) {
    const actual = new Set(query(targetPath, `PRAGMA table_info(${table})`).map((r) => r.name));
    const missing = columns.filter((column) => !actual.has(column));
    if (missing.length)
      throw new Error(`Import refused: target ${table} missing ${missing.join(", ")}`);
  }
  const nonEmpty = query(
    targetPath,
    "SELECT (SELECT COUNT(*) FROM projection_projects) AS projects, (SELECT COUNT(*) FROM projection_threads) AS threads, (SELECT COUNT(*) FROM projection_thread_messages) AS messages, (SELECT COUNT(*) FROM projection_thread_sessions) AS sessions",
  )[0];
  if (Object.values(nonEmpty).some(Number))
    throw new Error(`Import refused: target is non-empty (${JSON.stringify(nonEmpty)})`);
  for (const message of thread.messages)
    if (!["user", "assistant"].includes(message.role))
      throw new Error(`Import refused: unsupported message role ${message.role}`);

  const targetProjectId = randomUUID();
  const targetThreadId = randomUUID();
  const userMessages = thread.messages.filter((message) => message.role === "user");
  const statements = [
    "BEGIN IMMEDIATE",
    "CREATE TABLE IF NOT EXISTS t3_selected_thread_imports (target_project_id TEXT NOT NULL, target_thread_id TEXT PRIMARY KEY, legacy_project_id TEXT NOT NULL, legacy_thread_id TEXT NOT NULL UNIQUE, source_sha256 TEXT NOT NULL, imported_at TEXT NOT NULL, message_count INTEGER NOT NULL, provenance_json TEXT NOT NULL)",
    `INSERT INTO projection_projects (project_id, title, workspace_root, default_model_selection_json, scripts_json, created_at, updated_at, deleted_at) VALUES (${sql(targetProjectId)}, ${sql(project.title)}, ${sql(project.workspaceRoot)}, NULL, '[]', ${sql(project.createdAt ?? now)}, ${sql(project.updatedAt ?? now)}, NULL)`,
    `INSERT INTO projection_threads (thread_id, project_id, title, model_selection_json, runtime_mode, interaction_mode, branch, worktree_path, latest_turn_id, created_at, updated_at, archived_at, settled_override, settled_at, latest_user_message_at, pending_approval_count, pending_user_input_count, has_actionable_proposed_plan, deleted_at) VALUES (${sql(targetThreadId)}, ${sql(targetProjectId)}, ${sql(thread.title)}, ${sql(thread.modelSelection ?? '{"provider":"codex","model":"gpt-5"}')}, ${sql(thread.runtimeMode ?? "full-access")}, ${sql(thread.interactionMode ?? "default")}, ${sql(thread.branch)}, ${sql(thread.worktreePath)}, NULL, ${sql(thread.createdAt ?? now)}, ${sql(thread.updatedAt ?? now)}, NULL, 'settled', ${sql(now)}, ${sql(userMessages.at(-1)?.createdAt ?? null)}, 0, 0, 0, NULL)`,
    ...thread.messages.map(
      (message) =>
        `INSERT INTO projection_thread_messages (message_id, thread_id, turn_id, role, text, attachments_json, is_streaming, created_at, updated_at) VALUES (${sql(randomUUID())}, ${sql(targetThreadId)}, ${sql(message.turnId)}, ${sql(message.role)}, ${sql(message.text)}, ${sql(message.attachments === undefined ? null : JSON.stringify(message.attachments))}, 0, ${sql(message.createdAt)}, ${sql(message.updatedAt ?? message.createdAt)})`,
    ),
    `INSERT INTO t3_selected_thread_imports (target_project_id, target_thread_id, legacy_project_id, legacy_thread_id, source_sha256, imported_at, message_count, provenance_json) VALUES (${sql(targetProjectId)}, ${sql(targetThreadId)}, ${sql(project.legacyProjectId)}, ${sql(thread.legacyThreadId)}, ${sql(packet.source.sha256)}, ${sql(now)}, ${thread.messages.length}, ${sql(JSON.stringify({ legacyProjectId: project.legacyProjectId, legacyThreadId: thread.legacyThreadId, sourcePath: packet.source.path }))})`,
    "COMMIT",
  ];
  try {
    run(targetPath, statements.join(";\n"));
  } catch (error) {
    try {
      run(targetPath, "ROLLBACK");
    } catch {}
    throw error;
  }
  return {
    format: "t3-selected-thread-import-receipt",
    formatVersion: 1,
    sourceSha256: packet.source.sha256,
    targetSchemaMigration: EXPECTED_SCHEMA_MIGRATION,
    importedAt: now,
    imported: {
      projectCount: 1,
      threadCount: 1,
      messageCount: thread.messages.length,
      dateRange: thread.dateRange,
    },
    mapping: {
      legacyProjectId: project.legacyProjectId,
      targetProjectId,
      legacyThreadId: thread.legacyThreadId,
      targetThreadId,
    },
    excludedCategories: EXCLUDED_CATEGORIES,
    repeatImport: "refused: target non-empty and legacy_thread_id is unique in provenance",
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const packetPath = process.argv[process.argv.indexOf("--packet") + 1];
  const targetPath = process.argv[process.argv.indexOf("--target") + 1];
  if (!packetPath || !targetPath)
    throw new Error(
      "Usage: t3-selected-thread-import.mjs --packet export.json --target empty-state.sqlite [--receipt receipt.json]",
    );
  const receipt = importOneSelectedThread({
    packet: JSON.parse(readFileSync(packetPath, "utf8")),
    targetPath,
  });
  const receiptPath = process.argv.includes("--receipt")
    ? process.argv[process.argv.indexOf("--receipt") + 1]
    : undefined;
  if (receiptPath) writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
}
