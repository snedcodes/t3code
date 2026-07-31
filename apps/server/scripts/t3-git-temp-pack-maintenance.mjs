#!/usr/bin/env node

import { existsSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";

const TEMP_PACK_NAME = /^tmp_pack_[A-Za-z0-9._-]+$/;
const LEGACY_MARKERS = ["/.t3/userdata/", "T3-state-backup-2026-07-27.sqlite"];

function parseArgs(argv) {
  const args = new Set(argv);
  const directoryIndex = argv.indexOf("--pack-directory");
  return {
    packDirectory: directoryIndex >= 0 ? argv[directoryIndex + 1] : undefined,
    allowCleanup: args.has("--allow-cleanup"),
    confirmedQuiescent: args.has("--confirm-no-git-processes"),
  };
}

function assertSafePackDirectory(packDirectory) {
  const normalized = resolve(packDirectory);
  if (LEGACY_MARKERS.some((marker) => normalized.includes(marker))) {
    throw new Error("Git temp-pack maintenance refused: legacy/production-looking path");
  }
  if (
    dirname(normalized).endsWith("/objects") === false ||
    dirname(dirname(normalized)).length === 0
  ) {
    throw new Error("Git temp-pack maintenance refused: expected a .git/objects/pack directory");
  }
  return normalized;
}

function report(packDirectory) {
  const names = existsSync(packDirectory) ? readdirSync(packDirectory) : [];
  const entries = existsSync(packDirectory)
    ? names
        .filter((name) => TEMP_PACK_NAME.test(name))
        .flatMap((name) => {
          const path = `${packDirectory}/${name}`;
          try {
            const details = statSync(path);
            return details.isFile()
              ? [{ path, bytes: details.size, modifiedAtMs: details.mtimeMs }]
              : [];
          } catch {
            return [];
          }
        })
    : [];
  const gitDirectory = dirname(dirname(packDirectory));
  const lockCandidates = [
    `${gitDirectory}/index.lock`,
    `${gitDirectory}/FETCH_HEAD.lock`,
    ...names.filter((name) => name.endsWith(".lock")).map((name) => `${packDirectory}/${name}`),
  ].filter((path) => existsSync(path));
  return {
    format: "t3-git-temp-pack-maintenance-receipt",
    packDirectory,
    entries,
    totalBytes: entries.reduce((sum, entry) => sum + entry.bytes, 0),
    lockFiles: lockCandidates,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.packDirectory) {
    throw new Error(
      "Usage: t3-git-temp-pack-maintenance.mjs --pack-directory /absolute/.git/objects/pack [--allow-cleanup --confirm-no-git-processes]",
    );
  }
  const packDirectory = assertSafePackDirectory(args.packDirectory);
  const before = report(packDirectory);
  const refusalReason = !args.allowCleanup
    ? "diagnostic mode; explicit --allow-cleanup is required"
    : !args.confirmedQuiescent
      ? "caller must confirm that T3 and Git processes are quiescent"
      : before.lockFiles.length > 0
        ? "Git lock files are present"
        : null;
  const removed = [];
  if (refusalReason === null) {
    for (const entry of before.entries) {
      try {
        unlinkSync(entry.path);
        removed.push(entry);
      } catch {
        // Keep the receipt truthful: only report confirmed removals.
      }
    }
  }
  process.stdout.write(
    `${JSON.stringify({ ...before, removed, refused: refusalReason !== null, refusalReason }, null, 2)}\n`,
  );
}

main();
