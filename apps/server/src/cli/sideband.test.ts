import { assert, it } from "@effect/vitest";

import {
  resolveExactSidebandTarget,
  SidebandTargetAmbiguousError,
  SidebandTargetNotFoundError,
} from "./sideband.ts";

const thread = (id: string, title = "Target") => ({
  id,
  projectId: "project-1",
  title,
  archivedAt: null,
});
const snapshot = (threads: ReadonlyArray<unknown>) =>
  ({
    projects: [{ id: "project-1", title: "Portfolio", deletedAt: null }],
    threads,
  }) as any;

it("resolves one exact active project/title target", () => {
  const target = resolveExactSidebandTarget({
    snapshot: snapshot([thread("thread-1")]),
    projectTitle: "Portfolio",
    threadTitle: "Target",
  });
  assert.strictEqual(target.thread.id, "thread-1");
});

it("rejects missing exact targets", () => {
  assert.throws(
    () =>
      resolveExactSidebandTarget({
        snapshot: snapshot([]),
        projectTitle: "Portfolio",
        threadTitle: "Target",
      }),
    SidebandTargetNotFoundError,
  );
});

it("rejects duplicate exact targets", () => {
  assert.throws(
    () =>
      resolveExactSidebandTarget({
        snapshot: snapshot([thread("one"), thread("two")]),
        projectTitle: "Portfolio",
        threadTitle: "Target",
      }),
    SidebandTargetAmbiguousError,
  );
});
