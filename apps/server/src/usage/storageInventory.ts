// @effect-diagnostics nodeBuiltinImport:off
/**
 * Bounded metadata scanning for server-owned storage roots.
 *
 * The caller constructs the allowlisted roots from ServerConfig and provider
 * settings. This module never accepts a client-supplied path.
 *
 * @module storageInventory
 */
import * as NodeFSP from "node:fs/promises";
import * as NodePath from "node:path";
import * as DateTime from "effect/DateTime";

import type {
  StorageInventoryCategory,
  StorageInventoryEntry,
  StorageInventoryState,
} from "@t3tools/contracts";

const MAX_FILES_PER_ROOT = 50_000;

export interface StorageInventoryScanRoot {
  readonly label: string;
  readonly path: string;
  readonly category: StorageInventoryCategory;
  readonly populatedState: StorageInventoryState;
  /**
   * Explicit files are used for the SQLite primary plus WAL/SHM sidecars.
   * The displayed path remains the primary path and no directory is walked.
   */
  readonly paths?: readonly string[];
}

export interface StorageInventoryFile {
  readonly path: string;
  readonly size: number;
  readonly mtimeMs: number;
}

export interface StorageInventoryScanResult {
  readonly entry: StorageInventoryEntry;
  readonly files: readonly StorageInventoryFile[];
}

interface WalkState {
  seen: boolean;
  failed: boolean;
  limited: boolean;
  bytes: number;
  fileCount: number;
  oldestMtimeMs: number | null;
  latestMtimeMs: number | null;
  files: StorageInventoryFile[];
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { readonly code?: unknown }).code === "ENOENT"
  );
}

function updateMtime(state: WalkState, mtimeMs: number): void {
  state.oldestMtimeMs =
    state.oldestMtimeMs === null ? mtimeMs : Math.min(state.oldestMtimeMs, mtimeMs);
  state.latestMtimeMs =
    state.latestMtimeMs === null ? mtimeMs : Math.max(state.latestMtimeMs, mtimeMs);
}

async function walk(targetPath: string, state: WalkState): Promise<void> {
  let stats;
  try {
    stats = await NodeFSP.lstat(targetPath);
  } catch (error) {
    if (!isNotFound(error)) state.failed = true;
    return;
  }

  state.seen = true;
  // Do not follow symlinks or junctions outside the server-owned root.
  if (stats.isSymbolicLink()) return;

  if (stats.isDirectory()) {
    let entries;
    try {
      entries = await NodeFSP.readdir(targetPath);
    } catch {
      state.failed = true;
      return;
    }
    for (const name of entries) {
      if (state.fileCount >= MAX_FILES_PER_ROOT) {
        state.limited = true;
        return;
      }
      await walk(NodePath.join(targetPath, name), state);
      if (state.limited) return;
    }
    return;
  }

  if (!stats.isFile()) return;
  if (state.fileCount >= MAX_FILES_PER_ROOT) {
    state.limited = true;
    return;
  }

  state.fileCount += 1;
  state.bytes += stats.size;
  updateMtime(state, stats.mtimeMs);
  state.files.push({ path: targetPath, size: stats.size, mtimeMs: stats.mtimeMs });
}

function formatModifiedAt(mtimeMs: number | null): string | null {
  return mtimeMs === null ? null : DateTime.formatIso(DateTime.makeUnsafe(mtimeMs));
}

export async function scanStorageRoot(
  root: StorageInventoryScanRoot,
): Promise<StorageInventoryScanResult> {
  const state: WalkState = {
    seen: false,
    failed: false,
    limited: false,
    bytes: 0,
    fileCount: 0,
    oldestMtimeMs: null,
    latestMtimeMs: null,
    files: [],
  };

  for (const targetPath of root.paths ?? [root.path]) {
    await walk(targetPath, state);
    if (state.limited) break;
  }

  const message =
    state.failed && state.limited
      ? "The read was incomplete: some paths could not be read and the file bound was reached."
      : state.failed
        ? "Some paths in this bounded root could not be read."
        : state.limited
          ? "The read was capped at " + MAX_FILES_PER_ROOT + " files."
          : !state.seen
            ? "This known path is not present on the environment."
            : state.fileCount === 0
              ? "The known path contains no files."
              : null;

  const stateValue: StorageInventoryState =
    state.failed || state.limited
      ? "unknown"
      : state.fileCount === 0
        ? "inactive"
        : root.populatedState;

  return {
    entry: {
      label: root.label,
      path: root.path,
      category: root.category,
      bytes: state.bytes,
      fileCount: state.fileCount,
      oldestModifiedAt: formatModifiedAt(state.oldestMtimeMs),
      latestModifiedAt: formatModifiedAt(state.latestMtimeMs),
      state: stateValue,
      message,
    },
    files: state.files,
  };
}
