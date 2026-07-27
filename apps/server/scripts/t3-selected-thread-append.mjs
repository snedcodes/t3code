#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { SUPPORTED_SCHEMA_MIGRATIONS } from "./t3-selected-thread-export.mjs";

const APPROVED_THREAD_IDS = new Set([
  "1f2f56d6-f06c-4672-8118-030a18a4369d",
  "329e8f4b-9925-4129-860f-6b5608c65636",
]);
const sql = (value) =>
  value === null || value === undefined ? "NULL" : `'${String(value).replaceAll("'", "''")}'`;
const query = (path, statement) =>
  JSON.parse(
    execFileSync("sqlite3", ["-readonly", "-json", path, statement], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    }) || "[]",
  );
const run = (path, statement) =>
  execFileSync("sqlite3", [path], {
    encoding: "utf8",
    input: statement,
    maxBuffer: 64 * 1024 * 1024,
  });

function digest(path) {
  const output = execFileSync("shasum", ["-a", "256", path], { encoding: "utf8" }).trim();
  return output.split(/\s+/)[0];
}

function owners(path) {
  let output = "";
  try {
    output = execFileSync("lsof", ["-nP", "-Fpc", "--", path], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return [];
  }
  if (!output) return [];
  let pid = null;
  let command = null;
  for (const field of output.split("\n")) {
    if (field.startsWith("p")) pid = Number.parseInt(field.slice(1), 10);
    if (field.startsWith("c")) command = field.slice(1);
  }
  return Number.isInteger(pid) ? [{ pid, command, path }] : [];
}

function assertTargetInactive(targetPath) {
  const paths = [targetPath, `${targetPath}-wal`, `${targetPath}-shm`];
  const activeOwners = paths.flatMap(owners);
  const runtimePath = join(resolve(targetPath, ".."), "server-runtime.json");
  if (existsSync(runtimePath)) {
    let runtime;
    try {
      runtime = JSON.parse(readFileSync(runtimePath, "utf8"));
    } catch {
      throw new Error(`Append refused: unreadable runtime marker ${runtimePath}`);
    }
    if (Number.isInteger(runtime.pid)) {
      try {
        process.kill(runtime.pid, 0);
        activeOwners.push({ pid: runtime.pid, command: "server-runtime", path: runtimePath });
      } catch {}
    }
  }
  if (activeOwners.length > 0)
    throw new Error(
      `Append refused: target profile is active (${activeOwners.map((owner) => owner.pid).join(", ")})`,
    );
}

function fingerprint(message) {
  return JSON.stringify([message.role, message.text, message.turnId ?? null, message.createdAt]);
}

function assertSchema(targetPath) {
  const migration = Number(
    query(
      targetPath,
      "SELECT COALESCE(MAX(migration_id), 0) AS migration FROM effect_sql_migrations",
    )[0]?.migration ?? 0,
  );
  if (!SUPPORTED_SCHEMA_MIGRATIONS.has(migration))
    throw new Error(`Append refused: unsupported target migration ${migration}`);
  return migration;
}

export function appendSelectedThreads({ packet, targetPath, now = new Date().toISOString() }) {
  if (packet?.format !== "t3-selected-thread-export" || packet.formatVersion !== 1)
    throw new Error("Append refused: unsupported export packet");
  if (!packet.source?.sha256 || !SUPPORTED_SCHEMA_MIGRATIONS.has(Number(packet.source.migration)))
    throw new Error("Append refused: source SHA/schema guard failed");
  if (!Array.isArray(packet.threads) || packet.threads.length !== 2)
    throw new Error("Append refused: exactly two selected threads are required");
  if (packet.threads.some(({ thread }) => !APPROVED_THREAD_IDS.has(thread?.legacyThreadId)))
    throw new Error(
      "Append refused: packet contains a thread outside the approved two-thread scope",
    );
  assertTargetInactive(targetPath);
  const sourceShaBefore = digest(packet.source.path);
  if (sourceShaBefore !== packet.source.sha256)
    throw new Error("Append refused: source SHA does not match packet");
  const targetMigration = assertSchema(targetPath);
  const mappings = [];
  const statements = ["BEGIN IMMEDIATE"];

  for (const { project, thread } of packet.threads) {
    const mapping = query(
      targetPath,
      `SELECT target_project_id AS targetProjectId, target_thread_id AS targetThreadId, legacy_project_id AS legacyProjectId, legacy_thread_id AS legacyThreadId, message_count AS importedMessageCount FROM t3_selected_thread_imports WHERE legacy_thread_id = ${sql(thread.legacyThreadId)}`,
    )[0];
    if (!mapping)
      throw new Error(`Append refused: no provenance mapping for ${thread.legacyThreadId}`);
    const targetThread = query(
      targetPath,
      `SELECT t.title AS title, p.title AS projectTitle, p.workspace_root AS workspaceRoot FROM projection_threads t JOIN projection_projects p ON p.project_id=t.project_id WHERE t.thread_id=${sql(mapping.targetThreadId)} AND t.project_id=${sql(mapping.targetProjectId)}`,
    )[0];
    if (
      !targetThread ||
      targetThread.title !== thread.title ||
      targetThread.projectTitle !== project.title ||
      targetThread.workspaceRoot !== project.workspaceRoot
    )
      throw new Error(`Append refused: target metadata mismatch for ${thread.legacyThreadId}`);
    const existing = query(
      targetPath,
      `SELECT role, text, turn_id AS turnId, created_at AS createdAt FROM projection_thread_messages WHERE thread_id=${sql(mapping.targetThreadId)}`,
    );
    const existingFingerprints = new Set(existing.map(fingerprint));
    const inserts = [];
    let duplicateCount = 0;
    for (const message of thread.messages) {
      if (!["user", "assistant"].includes(message.role))
        throw new Error(`Append refused: unsupported role ${message.role}`);
      const key = fingerprint(message);
      if (existingFingerprints.has(key)) {
        duplicateCount += 1;
        continue;
      }
      existingFingerprints.add(key);
      inserts.push(message);
      statements.push(
        `INSERT INTO projection_thread_messages (message_id, thread_id, turn_id, role, text, attachments_json, is_streaming, created_at, updated_at) VALUES (${sql(randomUUID())}, ${sql(mapping.targetThreadId)}, ${sql(message.turnId)}, ${sql(message.role)}, ${sql(message.text)}, ${sql(message.attachments === undefined ? null : JSON.stringify(message.attachments))}, 0, ${sql(message.createdAt)}, ${sql(message.updatedAt ?? message.createdAt)})`,
      );
    }
    mappings.push({
      legacyProjectId: mapping.legacyProjectId,
      targetProjectId: mapping.targetProjectId,
      legacyThreadId: thread.legacyThreadId,
      targetThreadId: mapping.targetThreadId,
      title: thread.title,
      priorMessageCount: existing.length,
      sourceMessageCount: thread.messages.length,
      insertedCount: inserts.length,
      duplicateCount,
      finalMessageCount: existing.length + inserts.length,
      sourceDateRange: thread.dateRange,
    });
  }
  statements.push("COMMIT");
  try {
    run(targetPath, statements.join(";\n"));
  } catch (error) {
    try {
      run(targetPath, "ROLLBACK");
    } catch {}
    throw error;
  }
  const sourceShaAfter = digest(packet.source.path);
  if (sourceShaAfter !== sourceShaBefore)
    throw new Error("Append refused: source changed during append");
  const quickCheck = query(targetPath, "PRAGMA quick_check")[0]?.quick_check;
  if (quickCheck !== "ok") throw new Error(`Append failed: target quick_check=${quickCheck}`);
  return {
    format: "t3-selected-thread-append-receipt",
    formatVersion: 1,
    importedAt: now,
    scope: [...APPROVED_THREAD_IDS],
    source: {
      path: packet.source.path,
      sha256: sourceShaAfter,
      migration: Number(packet.source.migration),
      boundary: "fresh read-only online backup",
    },
    target: { path: resolve(targetPath), schemaMigration: targetMigration, quickCheck },
    threads: mappings,
    totals: {
      inserted: mappings.reduce((sum, item) => sum + item.insertedCount, 0),
      duplicates: mappings.reduce((sum, item) => sum + item.duplicateCount, 0),
    },
    excluded: [
      "all threads outside approved two-thread scope",
      "projects/threads/provenance changes",
      "activities/events/provider runtime",
    ],
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const packetPath = process.argv[process.argv.indexOf("--packet") + 1];
  const targetPath = process.argv[process.argv.indexOf("--target") + 1];
  const receiptPath = process.argv.includes("--receipt")
    ? process.argv[process.argv.indexOf("--receipt") + 1]
    : undefined;
  if (!packetPath || !targetPath)
    throw new Error(
      "Usage: t3-selected-thread-append.mjs --packet packet.json --target state.sqlite --receipt receipt.json",
    );
  const receipt = appendSelectedThreads({
    packet: JSON.parse(readFileSync(packetPath, "utf8")),
    targetPath,
  });
  if (receiptPath) writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
}
