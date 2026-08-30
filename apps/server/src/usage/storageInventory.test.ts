import * as NodeServices from "@effect/platform-node/NodeServices";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";

import { scanStorageRoot } from "./storageInventory.ts";

describe("scanStorageRoot", () => {
  it.effect("sums bounded files and preserves metadata for explicit paths", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "t3-storage-",
      });
      const databasePath = path.join(root, "state.sqlite");
      const walPath = databasePath + "-wal";
      yield* fileSystem.writeFileString(databasePath, "db");
      yield* fileSystem.writeFileString(walPath, "wal-data");

      const result = yield* Effect.promise(() =>
        scanStorageRoot({
          label: "SQLite database",
          path: databasePath,
          category: "database",
          populatedState: "active",
          paths: [databasePath, walPath],
        }),
      );

      expect(result.entry.bytes).toBe(10);
      expect(result.entry.fileCount).toBe(2);
      expect(result.entry.category).toBe("database");
      expect(result.entry.state).toBe("active");
      expect(result.entry.oldestModifiedAt).not.toBeNull();
      expect(result.entry.latestModifiedAt).not.toBeNull();
      expect(result.files).toHaveLength(2);
    }).pipe(Effect.provide(NodeServices.layer)),
  );

  it.effect("reports a known missing root as inactive without failing the read", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "t3-storage-missing-",
      });

      const result = yield* Effect.promise(() =>
        scanStorageRoot({
          label: "Attachments",
          path: path.join(root, "attachments"),
          category: "attachments",
          populatedState: "inactive",
        }),
      );

      expect(result.entry.bytes).toBe(0);
      expect(result.entry.fileCount).toBe(0);
      expect(result.entry.state).toBe("inactive");
      expect(result.entry.message).toContain("not present");
    }).pipe(Effect.provide(NodeServices.layer)),
  );
});
