import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";

const sql = (value) => `'${String(value).replaceAll("'", "''")}'`;
const exec = (db, statement) => execFileSync("sqlite3", [db, statement], { encoding: "utf8" });

test("prunes operational rows, compacts tool payloads, rotates logs, and protects messages", () => {
  const profile = mkdtempSync(join(tmpdir(), "t3-retention-proof."));
  const userdata = join(profile, "userdata");
  const logs = join(userdata, "logs");
  mkdirSync(logs, { recursive: true });
  const db = join(userdata, "state.sqlite");
  exec(
    db,
    `CREATE TABLE projection_projects (project_id TEXT PRIMARY KEY, title TEXT, workspace_root TEXT);
     CREATE TABLE projection_threads (thread_id TEXT PRIMARY KEY, project_id TEXT, title TEXT);
     CREATE TABLE projection_thread_messages (message_id TEXT PRIMARY KEY, thread_id TEXT, role TEXT, text TEXT);
     CREATE TABLE t3_selected_thread_imports (target_thread_id TEXT PRIMARY KEY, legacy_thread_id TEXT);
     CREATE TABLE projection_thread_activities (activity_id TEXT PRIMARY KEY, thread_id TEXT, turn_id TEXT, tone TEXT, kind TEXT, summary TEXT, payload_json TEXT, created_at TEXT, sequence INTEGER);
     CREATE TABLE orchestration_events (sequence INTEGER PRIMARY KEY AUTOINCREMENT, event_id TEXT, aggregate_kind TEXT, stream_id TEXT, stream_version INTEGER, event_type TEXT, occurred_at TEXT, payload_json TEXT, metadata_json TEXT);
     INSERT INTO projection_projects VALUES ('p1','Keep me','/tmp/workspace');
     INSERT INTO projection_threads VALUES ('t1','p1','Keep thread');
     INSERT INTO projection_thread_messages VALUES ('m1','t1','user','Keep this message');
     INSERT INTO t3_selected_thread_imports VALUES ('t1','legacy-t1');`,
  );
  for (let index = 1; index <= 5; index += 1) {
    exec(
      db,
      `INSERT INTO projection_thread_activities VALUES ('a${index}','t1',NULL,'info','tool.completed', 'tool ${index}', ${sql(JSON.stringify({ toolName: "shell", status: "completed", detail: "x".repeat(600) }))}, '2026-07-27T00:00:0${index}Z', ${index});`,
    );
  }
  for (let index = 1; index <= 3; index += 1) {
    exec(
      db,
      `INSERT INTO orchestration_events (event_id,aggregate_kind,stream_id,stream_version,event_type,occurred_at,payload_json,metadata_json) VALUES ('e${index}','thread','t1',${index},'tool.completed','2026-07-27T00:00:0${index}Z',${sql(JSON.stringify({ name: "shell", status: "completed", detail: "y".repeat(600) }))},'{}');`,
    );
  }
  writeFileSync(join(logs, "server.log"), "z".repeat(120));
  writeFileSync(
    join(userdata, "retention-policy.json"),
    `${JSON.stringify({ activityRowsPerThread: 2, orchestrationEventsPerThread: 2, logRotateBytes: 50, logGenerations: 3, logRetentionDays: 14 }, null, 2)}\n`,
  );
  const receipt = JSON.parse(
    execFileSync(
      process.execPath,
      [new URL("./t3-retention-maintenance.mjs", import.meta.url).pathname, "--profile", profile],
      {
        encoding: "utf8",
      },
    ),
  );

  expect(receipt.deleted).toEqual({ activities: 3, orchestrationEvents: 1 });
  expect(receipt.before.messages).toBe(1);
  expect(receipt.after.messages).toBe(1);
  expect(receipt.after.projects).toBe(1);
  expect(receipt.after.threads).toBe(1);
  expect(receipt.after.provenance).toBe(1);
  expect(receipt.rotatedLogs).toHaveLength(1);
  expect(Number(exec(db, "SELECT COUNT(*) FROM projection_thread_activities").trim())).toBe(2);
  expect(Number(exec(db, "SELECT COUNT(*) FROM orchestration_events").trim())).toBe(2);
  expect(exec(db, "SELECT text FROM projection_thread_messages").trim()).toBe("Keep this message");
  expect(
    Number(
      exec(
        db,
        "SELECT length(payload_json) FROM projection_thread_activities WHERE kind='tool.completed' LIMIT 1",
      ).trim(),
    ),
  ).toBeLessThan(600);
  expect(
    exec(
      db,
      "SELECT json_extract(payload_json,'$.retained') FROM orchestration_events WHERE event_type='tool.completed' LIMIT 1",
    ).trim(),
  ).toBe("compact-tool-receipt");
});
