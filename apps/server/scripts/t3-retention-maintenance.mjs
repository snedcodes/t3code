#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import {
  existsSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";

export const DEFAULT_RETENTION_POLICY = Object.freeze({
  activityRowsPerThread: 200,
  orchestrationEventsPerThread: 500,
  logRotateBytes: 25 * 1024 * 1024,
  logGenerations: 3,
  logRetentionDays: 14,
  toolReceiptSummaryChars: 256,
});

const POLICY_FILE = "retention-policy.json";
const LEGACY_PATH_MARKERS = [
  "/.t3/userdata/",
  "T3-state-backup-2026-07-27.sqlite",
  "state.sqlite.backup",
];
const sql = (value) => `'${String(value).replaceAll("'", "''")}'`;
const runSqlite = (dbPath, statement, readOnly = false) => {
  const args = readOnly ? ["-readonly", "-json", dbPath, statement] : [dbPath, statement];
  return execFileSync("sqlite3", args, { encoding: "utf8" }).trim();
};
const query = (dbPath, statement) => JSON.parse(runSqlite(dbPath, statement, true) || "[]");
const tableExists = (dbPath, name) =>
  query(dbPath, `SELECT 1 FROM sqlite_master WHERE type='table' AND name=${sql(name)}`).length > 0;
const count = (dbPath, table) =>
  tableExists(dbPath, table) ? query(dbPath, `SELECT COUNT(*) AS n FROM ${table}`)[0].n : 0;

export function assertSafeProfilePath(profilePath, dbPath) {
  const values = [resolve(profilePath), resolve(dbPath)];
  if (values.some((value) => LEGACY_PATH_MARKERS.some((marker) => value.includes(marker)))) {
    throw new Error("Retention refused: legacy or production-looking profile/database path");
  }
  if (
    values.some((value) => value.endsWith("/.t3") || value.endsWith("/.t3/userdata/state.sqlite"))
  ) {
    throw new Error("Retention refused: shared production .t3 profile");
  }
}

function assertProfileNotActive(profilePath) {
  const runtimePath = join(profilePath, "userdata", "server-runtime.json");
  if (!existsSync(runtimePath)) return;
  let runtime;
  try {
    runtime = JSON.parse(readFileSync(runtimePath, "utf8"));
  } catch {
    throw new Error(`Retention refused: active runtime state is unreadable at ${runtimePath}`);
  }
  if (Number.isInteger(runtime.pid)) {
    try {
      process.kill(runtime.pid, 0);
      throw new Error(`Retention refused: profile is active (pid ${runtime.pid})`);
    } catch (error) {
      if (error?.message?.includes("profile is active")) throw error;
    }
  }
}

function loadPolicy(profilePath, overrides = {}) {
  const policyPath = join(profilePath, "userdata", POLICY_FILE);
  const configured = existsSync(policyPath) ? JSON.parse(readFileSync(policyPath, "utf8")) : {};
  const policy = { ...DEFAULT_RETENTION_POLICY, ...configured, ...overrides };
  if (
    policy.logGenerations < 1 ||
    policy.activityRowsPerThread < 1 ||
    policy.orchestrationEventsPerThread < 1
  )
    throw new Error("Retention refused: limits must be positive");
  if (!existsSync(policyPath)) writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  return { policy, policyPath };
}

function fileSize(path) {
  try {
    return statSync(path).size;
  } catch {
    return 0;
  }
}

function logFiles(logsPath) {
  if (!existsSync(logsPath)) return [];
  return readdirSync(logsPath, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(logsPath, entry.name));
}

function logBytes(logsPath) {
  return logFiles(logsPath).reduce((sum, path) => sum + fileSize(path), 0);
}

function rotateLogs(logsPath, policy, now) {
  const rotated = [];
  const cutoff = now - policy.logRetentionDays * 24 * 60 * 60 * 1000;
  for (const path of logFiles(logsPath)) {
    const stat = statSync(path);
    if (stat.mtimeMs < cutoff) {
      unlinkSync(path);
      rotated.push({ path, action: "expired" });
      continue;
    }
    if (stat.size <= policy.logRotateBytes) continue;
    for (let generation = policy.logGenerations - 1; generation >= 1; generation -= 1) {
      const older = `${path}.${generation}`;
      const newer = `${path}.${generation + 1}`;
      if (existsSync(older)) {
        if (generation + 1 >= policy.logGenerations) unlinkSync(older);
        else renameSync(older, newer);
      }
    }
    renameSync(path, `${path}.1`);
    writeFileSync(path, "");
    rotated.push({ path, action: "rotated" });
  }
  return rotated;
}

function pruneDatabase(dbPath, policy) {
  const statements = ["BEGIN IMMEDIATE"];
  if (tableExists(dbPath, "projection_thread_activities")) {
    statements.push(
      `DELETE FROM projection_thread_activities WHERE activity_id IN (SELECT activity_id FROM (SELECT activity_id, ROW_NUMBER() OVER (PARTITION BY thread_id ORDER BY COALESCE(sequence, 0) DESC, created_at DESC, activity_id DESC) AS row_number FROM projection_thread_activities) WHERE row_number > ${Number(policy.activityRowsPerThread)})`,
    );
    statements.push(
      `UPDATE projection_thread_activities SET payload_json = json_object('retained','compact-tool-receipt','toolName',COALESCE(json_extract(payload_json,'$.toolName'),json_extract(payload_json,'$.name')),'status',COALESCE(json_extract(payload_json,'$.status'),'completed'),'summary',substr(COALESCE(json_extract(payload_json,'$.summary'),json_extract(payload_json,'$.detail'),''),1,${Number(policy.toolReceiptSummaryChars)}),'error',substr(COALESCE(json_extract(payload_json,'$.error'),''),1,${Number(policy.toolReceiptSummaryChars)})) WHERE kind = 'tool.completed'`,
    );
  }
  if (tableExists(dbPath, "orchestration_events")) {
    statements.push(
      `DELETE FROM orchestration_events WHERE sequence IN (SELECT sequence FROM (SELECT sequence, ROW_NUMBER() OVER (PARTITION BY stream_id ORDER BY sequence DESC) AS row_number FROM orchestration_events WHERE aggregate_kind = 'thread') WHERE row_number > ${Number(policy.orchestrationEventsPerThread)})`,
    );
    statements.push(
      "UPDATE orchestration_events SET payload_json = json_object('retained','compact-tool-receipt','toolName',COALESCE(json_extract(payload_json,'$.toolName'),json_extract(payload_json,'$.name')),'status',COALESCE(json_extract(payload_json,'$.status'),'completed'),'summary',substr(COALESCE(json_extract(payload_json,'$.summary'),json_extract(payload_json,'$.detail'),''),1,256),'error',substr(COALESCE(json_extract(payload_json,'$.error'),''),1,256)) WHERE event_type = 'tool.completed'",
    );
  }
  statements.push("COMMIT");
  runSqlite(dbPath, statements.join(";\n"));
}

export function runRetentionMaintenance({
  profilePath,
  dbPath = join(profilePath, "userdata", "state.sqlite"),
  logsPath = join(profilePath, "userdata", "logs"),
  overrides = {},
  now = Date.now(),
}) {
  assertSafeProfilePath(profilePath, dbPath);
  if (!existsSync(dbPath))
    throw new Error(`Retention refused: database does not exist at ${dbPath}`);
  assertProfileNotActive(profilePath);
  const { policy, policyPath } = loadPolicy(profilePath, overrides);
  const before = {
    databaseBytes: fileSize(dbPath),
    logBytes: logBytes(logsPath),
    messages: count(dbPath, "projection_thread_messages"),
    projects: count(dbPath, "projection_projects"),
    threads: count(dbPath, "projection_threads"),
    provenance: count(dbPath, "t3_selected_thread_imports"),
    activities: count(dbPath, "projection_thread_activities"),
    orchestrationEvents: count(dbPath, "orchestration_events"),
  };
  pruneDatabase(dbPath, policy);
  const rotatedLogs = rotateLogs(logsPath, policy, now);
  const after = {
    databaseBytes: fileSize(dbPath),
    logBytes: logBytes(logsPath),
    messages: count(dbPath, "projection_thread_messages"),
    projects: count(dbPath, "projection_projects"),
    threads: count(dbPath, "projection_threads"),
    provenance: count(dbPath, "t3_selected_thread_imports"),
    activities: count(dbPath, "projection_thread_activities"),
    orchestrationEvents: count(dbPath, "orchestration_events"),
  };
  return {
    format: "t3-retention-maintenance-receipt",
    profilePath: resolve(profilePath),
    databasePath: resolve(dbPath),
    policyPath: resolve(policyPath),
    policy,
    before,
    after,
    deleted: {
      activities: before.activities - after.activities,
      orchestrationEvents: before.orchestrationEvents - after.orchestrationEvents,
    },
    rotatedLogs,
    protectedTables: [
      "projection_thread_messages",
      "projection_projects",
      "projection_threads",
      "t3_selected_thread_imports",
    ],
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = Object.fromEntries(
    process.argv
      .slice(2)
      .flatMap((arg, index, all) => (arg.startsWith("--") ? [[arg.slice(2), all[index + 1]]] : [])),
  );
  if (!args.profile)
    throw new Error("Usage: t3-retention-maintenance.mjs --profile /absolute/disposable/profile");
  const receipt = runRetentionMaintenance({ profilePath: resolve(args.profile) });
  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
}
