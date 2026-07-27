#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

export const EXPECTED_SCHEMA_MIGRATION = 33;
const REQUIRED_TABLES = ["projection_projects", "projection_threads", "projection_thread_messages"];
const EXCLUDED_TABLES = ["projection_thread_activities", "orchestration_events"];

const digest = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const parseJson = (value, fallback = null) => {
  if (value === null || value === undefined) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};
const sql = (value) => `'${String(value).replaceAll("'", "''")}'`;
const query = (path, statement) =>
  JSON.parse(
    execFileSync("sqlite3", ["-readonly", "-json", path, statement], { encoding: "utf8" }) || "[]",
  );

export function inventoryCopiedDatabase({
  sourcePath,
  threadIds = [],
  expectedMigration = EXPECTED_SCHEMA_MIGRATION,
}) {
  const beforeHash = digest(sourcePath);
  try {
    const migration =
      query(sourcePath, "SELECT COALESCE(MAX(id), 0) AS id FROM effect_sql_migrations")[0]?.id ?? 0;
    if (Number(migration) !== expectedMigration) {
      throw new Error(
        `Schema guard refused source: expected migration ${expectedMigration}, found ${migration}`,
      );
    }
    const tables = new Set(
      query(sourcePath, "SELECT name FROM sqlite_master WHERE type = 'table'").map((r) => r.name),
    );
    const missing = REQUIRED_TABLES.filter((table) => !tables.has(table));
    if (missing.length)
      throw new Error(`Schema guard refused source: missing ${missing.join(", ")}`);
    const selected = threadIds.length
      ? threadIds
      : query(
          sourcePath,
          "SELECT thread_id FROM projection_threads WHERE deleted_at IS NULL ORDER BY created_at, thread_id",
        ).map((r) => r.thread_id);
    const threads = [];
    for (const threadId of selected) {
      const thread = query(
        sourcePath,
        `SELECT thread_id AS legacyThreadId, project_id AS projectId, title, branch, worktree_path AS worktreePath, archived_at AS archivedAt, deleted_at AS deletedAt, created_at AS createdAt, updated_at AS updatedAt FROM projection_threads WHERE thread_id = ${sql(threadId)}`,
      )[0];
      if (!thread) throw new Error(`Thread not found: ${threadId}`);
      const project = query(
        sourcePath,
        `SELECT project_id AS legacyProjectId, title, workspace_root AS workspaceRoot, deleted_at AS deletedAt, created_at AS createdAt, updated_at AS updatedAt FROM projection_projects WHERE project_id = ${sql(thread.projectId)}`,
      )[0];
      if (!project) throw new Error(`Project not found for thread: ${threadId}`);
      const messages = query(
        sourcePath,
        `SELECT message_id AS legacyMessageId, thread_id AS legacyThreadId, turn_id AS turnId, role, text, attachments_json AS attachments, is_streaming AS isStreaming, created_at AS createdAt, updated_at AS updatedAt FROM projection_thread_messages WHERE thread_id = ${sql(threadId)} ORDER BY created_at ASC, message_id ASC`,
      ).map((m) => ({
        ...m,
        isStreaming: Boolean(m.isStreaming),
        attachments: parseJson(m.attachments, undefined),
      }));
      threads.push({
        project,
        thread: {
          ...thread,
          messages,
          messageCount: messages.length,
          dateRange: {
            first: messages[0]?.createdAt ?? null,
            last: messages.at(-1)?.createdAt ?? null,
          },
          selection: messages.length ? "restore_now" : "legacy_only",
        },
      });
    }
    const projects = [
      ...new Map(threads.map(({ project }) => [project.legacyProjectId, project])).values(),
    ];
    return {
      format: "t3-selected-thread-export",
      formatVersion: 1,
      source: { path: sourcePath, sha256: beforeHash, migration },
      excludedTables: EXCLUDED_TABLES,
      projects,
      threads,
      activeRosterDryRun: threads.map(({ project, thread }) => ({
        legacyProjectId: project.legacyProjectId,
        legacyThreadId: thread.legacyThreadId,
        projectTitle: project.title,
        threadTitle: thread.title,
        selection: thread.selection,
        messageCount: thread.messageCount,
      })),
    };
  } finally {
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = Object.fromEntries(
    process.argv
      .slice(2)
      .map((arg, i, a) => (arg.startsWith("--") ? [arg.slice(2), a[i + 1]] : []))
      .filter((x) => x.length),
  );
  if (!args.source)
    throw new Error(
      "Usage: t3-selected-thread-export.mjs --source COPY.sqlite [--thread THREAD_ID ...]",
    );
  const threadIds = process.argv
    .flatMap((arg, i) => (arg === "--thread" ? [process.argv[i + 1]] : []))
    .filter(Boolean);
  const result = inventoryCopiedDatabase({ sourcePath: args.source, threadIds });
  if (digest(args.source) !== result.source.sha256)
    throw new Error("Source changed during read-only export");
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
