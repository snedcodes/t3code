import { readdir, stat, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";

export const DEFAULT_GIT_FETCH_MIN_FREE_BYTES = 512 * 1024 * 1024;

const TEMP_PACK_NAME = /^tmp_pack_[A-Za-z0-9._-]+$/;
const LOCK_NAMES = new Set(["index.lock", "FETCH_HEAD.lock", "ORIG_HEAD.lock"]);

export interface GitDiskSpace {
  readonly availableBytes: number;
  readonly blockSize: number;
}

export interface GitTempPackEntry {
  readonly path: string;
  readonly bytes: number;
  readonly modifiedAtMs: number;
}

export interface GitTempPackReport {
  readonly packDirectory: string;
  readonly entries: ReadonlyArray<GitTempPackEntry>;
  readonly totalBytes: number;
  readonly blockers: ReadonlyArray<string>;
}

export interface GitTempPackCleanupResult extends GitTempPackReport {
  readonly removed: ReadonlyArray<GitTempPackEntry>;
  readonly refused: boolean;
  readonly refusalReason: string | null;
}

export function shouldPauseGitFetch(
  disk: GitDiskSpace | null,
  minimumFreeBytes = DEFAULT_GIT_FETCH_MIN_FREE_BYTES,
): boolean {
  // A fetch must not start when the platform cannot establish free space.
  return disk === null || disk.availableBytes < minimumFreeBytes;
}

export async function readGitDiskSpace(path: string): Promise<GitDiskSpace | null> {
  try {
    const fs = await import("node:fs/promises");
    const result = await fs.statfs(path);
    return {
      availableBytes: Number(result.bavail) * Number(result.bsize),
      blockSize: Number(result.bsize),
    };
  } catch {
    // Unsupported or inaccessible statfs must not make ordinary status reads fail.
    return null;
  }
}

function isLockName(name: string): boolean {
  return LOCK_NAMES.has(name) || name.endsWith(".lock");
}

async function listTempPacks(packDirectory: string): Promise<ReadonlyArray<GitTempPackEntry>> {
  let names: Array<string>;
  try {
    names = await readdir(packDirectory);
  } catch {
    return [];
  }

  const entries: Array<GitTempPackEntry> = [];
  for (const name of names) {
    if (!TEMP_PACK_NAME.test(name)) continue;
    try {
      const details = await stat(join(packDirectory, name));
      if (!details.isFile()) continue;
      entries.push({
        path: join(packDirectory, name),
        bytes: details.size,
        modifiedAtMs: details.mtimeMs,
      });
    } catch {
      // A concurrently disappearing temp file is not a cleanup failure.
    }
  }
  return entries;
}

async function listCleanupBlockers(packDirectory: string): Promise<ReadonlyArray<string>> {
  const gitDirectory = dirname(dirname(packDirectory));
  const candidates = [join(gitDirectory, "index.lock"), join(gitDirectory, "FETCH_HEAD.lock")];
  let names: Array<string> = [];
  try {
    names = await readdir(packDirectory);
  } catch {
    return [];
  }

  const blockers: Array<string> = [];
  for (const candidate of candidates) {
    try {
      await stat(candidate);
      blockers.push(candidate);
    } catch {
      // absent
    }
  }
  for (const name of names) {
    if (isLockName(name)) blockers.push(join(packDirectory, name));
  }
  return blockers;
}

export async function inspectGitTempPacks(packDirectory: string): Promise<GitTempPackReport> {
  const entries = await listTempPacks(packDirectory);
  const blockers = await listCleanupBlockers(packDirectory);
  return {
    packDirectory,
    entries,
    totalBytes: entries.reduce((total, entry) => total + entry.bytes, 0),
    blockers,
  };
}

/**
 * Explicit operator-only cleanup. The caller must attest that T3/Git are
 * quiescent; lock checks are repeated immediately before removal. This is not
 * called by status refresh and never removes normal pack files.
 */
export async function cleanupGitTempPacks(input: {
  readonly packDirectory: string;
  readonly allowCleanup: boolean;
  readonly noActiveGitProcessesConfirmed: boolean;
}): Promise<GitTempPackCleanupResult> {
  const report = await inspectGitTempPacks(input.packDirectory);
  const refusalReason = !input.allowCleanup
    ? "explicit cleanup approval is required"
    : !input.noActiveGitProcessesConfirmed
      ? "caller has not confirmed that T3 and Git processes are quiescent"
      : report.blockers.length > 0
        ? "Git lock files are present"
        : null;

  if (refusalReason !== null) {
    return { ...report, removed: [], refused: true, refusalReason };
  }

  const removed: Array<GitTempPackEntry> = [];
  for (const entry of report.entries) {
    try {
      await unlink(entry.path);
      removed.push(entry);
    } catch {
      // Report only files that were actually removed.
    }
  }
  return { ...report, removed, refused: false, refusalReason: null };
}
