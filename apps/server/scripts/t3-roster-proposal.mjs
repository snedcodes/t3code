#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const OPERATIONAL_PROFILE = "/Users/snedmusic/.t3-operational";
const RETENTION_COMMAND = `node apps/server/scripts/t3-retention-maintenance.mjs --profile ${OPERATIONAL_PROFILE}`;
const RECENT_DAYS = 14;
const titleSignals = [
  ["portfolio overseer", "Portfolio Overseer role title", 45],
  ["t3 reliability", "T3 reliability role title", 40],
  ["agents dev guidelines", "Agents Dev Guidelines role title", 40],
  ["voicetools", "VoiceTools role/project title", 35],
  ["av transform", "AV Transform role/project title", 30],
  ["ableton", "Ableton role/project title", 25],
  ["volgrid", "VolGrid role/project title", 25],
  ["hummingbot", "Hummingbot role/project title", 25],
  ["coordinator", "Coordinator role title", 20],
];
const automaticRoleSignals = [
  "portfolio overseer",
  "t3 reliability",
  "voicetools coordinator",
  "agents dev guidelines",
  "av transform coordinator",
  "ableton coordinator",
  "volgrid coordinator",
  "hummingbot coordinator",
];

const sql = (value) => `'${String(value).replaceAll("'", "''")}'`;
const query = (dbPath, statement) =>
  JSON.parse(
    execFileSync("sqlite3", ["-readonly", "-json", dbPath, statement], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    }) || "[]",
  );
const digest = (path) =>
  execFileSync("shasum", ["-a", "256", path], { encoding: "utf8" }).split(/\s+/)[0];
const daysSince = (iso, now) => Math.max(0, (now - Date.parse(iso)) / 86_400_000);
const normalizeTitle = (title) => String(title).toLowerCase().replace(/\s+/g, " ").trim();
const markdownCell = (value) =>
  String(value ?? "—")
    .replaceAll("|", "\\|")
    .replaceAll("\n", " ");

function sessionEvidence(snapshotPath) {
  const rows = query(
    snapshotPath,
    "SELECT thread_id AS threadId, status, provider_name AS providerName, updated_at AS updatedAt FROM projection_thread_sessions",
  );
  const runtimeRows = query(
    snapshotPath,
    "SELECT thread_id AS threadId, status, provider_name AS providerName, last_seen_at AS lastSeenAt FROM provider_session_runtime",
  );
  const evidence = new Map();
  for (const row of [...rows, ...runtimeRows]) {
    const current = evidence.get(row.threadId) ?? [];
    current.push(row);
    evidence.set(row.threadId, current);
  }
  return evidence;
}

function classify(packet, snapshotPath, now = Date.now()) {
  const sessions = sessionEvidence(snapshotPath);
  const activeByTitle = new Set(
    packet.threads
      .filter(({ thread }) => !thread.archivedAt)
      .map(({ thread }) => normalizeTitle(thread.title)),
  );
  return packet.threads
    .map(({ project, thread }) => {
      const title = normalizeTitle(thread.title);
      const active = !thread.archivedAt && !project.deletedAt;
      const lastActivity = thread.dateRange.last ?? thread.updatedAt;
      const ageDays = lastActivity ? daysSince(lastActivity, now) : Infinity;
      const recent = ageDays <= RECENT_DAYS;
      const matchedSignals = titleSignals.filter(([signal]) =>
        `${title} ${normalizeTitle(project.title)}`.includes(signal),
      );
      const automaticRoleMatch = automaticRoleSignals.some((signal) => title.includes(signal));
      const sessionRows = sessions.get(thread.legacyThreadId) ?? [];
      const liveSession = sessionRows.some((row) =>
        /active|running|connected|ready/i.test(row.status ?? ""),
      );
      const score =
        (active ? 20 : 0) +
        (recent ? 25 : ageDays <= 30 ? 10 : 0) +
        (liveSession ? 25 : 0) +
        matchedSignals.reduce((sum, [, , points]) => sum + points, 0);
      let classification = "legacy_only";
      let reason = "No strong current-roster evidence; preserve as legacy history.";
      if (!active && activeByTitle.has(title)) {
        reason = "Archived duplicate of an unarchived thread with the same human title.";
      } else if (active && score >= 75 && automaticRoleMatch) {
        classification = "restore_now";
        reason = [
          "unarchived/current project",
          recent ? `latest activity ${Math.round(ageDays)}d ago` : null,
          liveSession ? "provider session evidence present" : null,
          ...matchedSignals.map(([, explanation]) => explanation),
        ]
          .filter(Boolean)
          .join("; ");
      } else if (active && (score >= 40 || matchedSignals.length > 0)) {
        classification = "needs_user_decision";
        reason =
          "Some current or topical evidence exists, but ownership/recency is not strong enough for automatic selection.";
      }
      const attachments = thread.messages.filter(
        (message) => Array.isArray(message.attachments) && message.attachments.length > 0,
      ).length;
      return {
        classification,
        score,
        reason,
        projectTitle: project.title,
        workspaceRoot: project.workspaceRoot,
        threadTitle: thread.title,
        legacyProjectId: project.legacyProjectId,
        legacyThreadId: thread.legacyThreadId,
        messageCount: thread.messageCount,
        dateRange: thread.dateRange,
        archivedAt: thread.archivedAt,
        attachments: attachments
          ? `metadata present on ${attachments} message(s); validate against current ChatAttachment schema`
          : "none observed",
        sessionEvidence: sessionRows,
      };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.projectTitle.localeCompare(b.projectTitle) ||
        a.threadTitle.localeCompare(b.threadTitle),
    );
}

function renderMarkdown({ source, roster, output }) {
  const selected = roster.filter((entry) => entry.classification === "restore_now");
  const decisions = roster.filter((entry) => entry.classification === "needs_user_decision");
  const legacy = roster.filter((entry) => entry.classification === "legacy_only");
  const row = (entry) =>
    `| ${markdownCell(entry.projectTitle)} | ${markdownCell(entry.workspaceRoot)} | ${markdownCell(entry.threadTitle)} | ${entry.messageCount} | ${markdownCell(entry.dateRange.first)} → ${markdownCell(entry.dateRange.last)} | ${markdownCell(entry.legacyThreadId)} | ${markdownCell(entry.reason)} |`;
  return `# T3 lean-profile roster proposal

Status: dry run only. No operational profile or real session was created.

## Source evidence

- Snapshot: \`${source.snapshotPath}\`
- SHA-256: \`${source.sha256}\`
- SQLite quick_check: \`${source.quickCheck}\`
- Schema migration: ${source.migration}
- Exported inventory: ${source.projectCount} projects, ${source.threadCount} threads, ${source.messageCount} messages

Future target: \`${output.operationalProfile}\`

Retention command after target creation:

\`\`\`sh
${output.retentionCommand}
\`\`\`

## Proposed restore_now (${selected.length})

These are ranked from snapshot evidence only; this is not import approval.

| Project | Workspace root | Thread | Messages | Date range | Legacy thread ID | Selection evidence |
|---|---|---|---:|---|---|---|
${selected.map(row).join("\n") || "| — | — | None | — | — | — | — |"}

## needs_user_decision (${decisions.length})

| Project | Workspace root | Thread | Messages | Date range | Legacy thread ID | Reason |
|---|---|---|---:|---|---|---|
${decisions.slice(0, 12).map(row).join("\n") || "| — | — | None | — | — | — | — |"}

Additional needs-user-decision entries are retained in the JSON manifest.

## legacy_only

${legacy.length} threads remain legacy-only, including archived duplicates and threads without strong current-roster evidence. No message or source data was changed.

Attachment caveat: attachment metadata is preserved in the export where present, but future import must validate it against the current native attachment schema.
`;
}

export function generateRosterProposal({ snapshotPath, exportPath, outputDir, now = Date.now() }) {
  const snapshot = resolve(snapshotPath);
  const packet = JSON.parse(readFileSync(exportPath, "utf8"));
  const quickCheck = query(snapshot, "PRAGMA quick_check")[0]?.quick_check ?? "unknown";
  const source = {
    snapshotPath: snapshot,
    sha256: digest(snapshot),
    quickCheck,
    migration: packet.source.migration,
    projectCount: packet.projects.length,
    threadCount: packet.threads.length,
    messageCount: packet.threads.reduce((sum, entry) => sum + entry.thread.messageCount, 0),
  };
  if (source.sha256 !== packet.source.sha256)
    throw new Error("Roster refused: snapshot SHA differs from exporter packet");
  if (source.quickCheck !== "ok")
    throw new Error(`Roster refused: SQLite quick_check returned ${source.quickCheck}`);
  const roster = classify(packet, snapshot, now);
  const output = {
    operationalProfile: OPERATIONAL_PROFILE,
    retentionCommand: RETENTION_COMMAND,
    importAuthorized: false,
    sourceSnapshotSha256: source.sha256,
  };
  mkdirSync(outputDir, { recursive: true });
  const manifest = {
    format: "t3-lean-profile-roster-proposal",
    formatVersion: 1,
    generatedAt: new Date(now).toISOString(),
    source,
    output,
    counts: {
      restoreNow: roster.filter((entry) => entry.classification === "restore_now").length,
      needsUserDecision: roster.filter((entry) => entry.classification === "needs_user_decision")
        .length,
      legacyOnly: roster.filter((entry) => entry.classification === "legacy_only").length,
    },
    roster,
  };
  const manifestPath = resolve(outputDir, "roster-proposal.json");
  const markdownPath = resolve(outputDir, "roster-proposal.md");
  const planPath = resolve(outputDir, "dry-run-import-plan.json");
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(markdownPath, renderMarkdown({ source, roster, output }));
  writeFileSync(
    planPath,
    `${JSON.stringify(
      {
        format: "t3-selected-thread-dry-run-import-plan",
        generatedAt: manifest.generatedAt,
        source,
        futureOperationalProfile: OPERATIONAL_PROFILE,
        retentionCommand: RETENTION_COMMAND,
        importAuthorized: false,
        selectedLegacyThreadIds: roster
          .filter((entry) => entry.classification === "restore_now")
          .map((entry) => entry.legacyThreadId),
        excludedByDefault: roster
          .filter((entry) => entry.classification !== "restore_now")
          .map((entry) => ({
            legacyThreadId: entry.legacyThreadId,
            classification: entry.classification,
          })),
      },
      null,
      2,
    )}\n`,
  );
  return { manifestPath, markdownPath, planPath, manifest };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = Object.fromEntries(
    process.argv
      .slice(2)
      .flatMap((arg, index, all) => (arg.startsWith("--") ? [[arg.slice(2), all[index + 1]]] : [])),
  );
  if (!args.snapshot || !args.export || !args["output-dir"])
    throw new Error(
      "Usage: t3-roster-proposal.mjs --snapshot SNAPSHOT.sqlite --export export.json --output-dir ARCHIVE_DIR",
    );
  const result = generateRosterProposal({
    snapshotPath: args.snapshot,
    exportPath: args.export,
    outputDir: args["output-dir"],
  });
  process.stdout.write(
    `${JSON.stringify({ ...result, manifest: { counts: result.manifest.counts, output: result.manifest.output } }, null, 2)}\n`,
  );
}
