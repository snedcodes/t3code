import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";

import { cleanupGitTempPacks, inspectGitTempPacks, shouldPauseGitFetch } from "./GitFetchSafety.ts";

it("pauses below the fetch free-space threshold and permits exactly the threshold", () => {
  assert.isTrue(shouldPauseGitFetch({ availableBytes: 99, blockSize: 4096 }, 100));
  assert.isFalse(shouldPauseGitFetch({ availableBytes: 100, blockSize: 4096 }, 100));
  assert.isTrue(shouldPauseGitFetch(null, 100));
});

it.effect("refuses unconfirmed temp-pack cleanup and reports an approved cleanup", () =>
  Effect.promise(async () => {
    const root = await mkdtemp(join(tmpdir(), "t3-git-fetch-safety-"));
    const packDirectory = join(root, ".git", "objects", "pack");
    await mkdir(packDirectory, { recursive: true });
    const tempPack = join(packDirectory, "tmp_pack_fixture");
    const normalPack = join(packDirectory, "pack-normal.pack");
    await writeFile(tempPack, "orphaned");
    await writeFile(normalPack, "keep");

    try {
      const before = await inspectGitTempPacks(packDirectory);
      assert.equal(before.entries.length, 1);
      assert.equal(before.totalBytes, 8);

      const refused = await cleanupGitTempPacks({
        packDirectory,
        allowCleanup: true,
        noActiveGitProcessesConfirmed: false,
      });
      assert.isTrue(refused.refused);
      assert.equal(refused.removed.length, 0);

      const cleaned = await cleanupGitTempPacks({
        packDirectory,
        allowCleanup: true,
        noActiveGitProcessesConfirmed: true,
      });
      assert.isFalse(cleaned.refused);
      assert.equal(cleaned.removed.length, 1);
      assert.equal(cleaned.removed[0]?.bytes, 8);

      const after = await inspectGitTempPacks(packDirectory);
      assert.equal(after.entries.length, 0);
      assert.equal(after.totalBytes, 0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }),
);

it.effect("refuses cleanup while Git lock files are present", () =>
  Effect.promise(async () => {
    const root = await mkdtemp(join(tmpdir(), "t3-git-fetch-lock-"));
    const packDirectory = join(root, ".git", "objects", "pack");
    await mkdir(packDirectory, { recursive: true });
    await writeFile(join(packDirectory, "tmp_pack_fixture"), "orphaned");
    await writeFile(join(root, ".git", "index.lock"), "active");

    try {
      const result = await cleanupGitTempPacks({
        packDirectory,
        allowCleanup: true,
        noActiveGitProcessesConfirmed: true,
      });
      assert.isTrue(result.refused);
      assert.include(result.refusalReason ?? "", "lock");
      assert.equal(result.removed.length, 0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }),
);
