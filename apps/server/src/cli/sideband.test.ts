import { assert, it } from "@effect/vitest";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";

import {
  resolveExactSidebandTarget,
  SidebandTargetAmbiguousError,
  SidebandTargetNotFoundError,
  withSidebandSession,
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

class BusyError extends Data.TaggedError("BusyError")<{}> {}

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

it.effect("retries transient auth-session locks within a bounded limit", () =>
  Effect.gen(function* () {
    let attempts = 0;
    let revoked = false;
    const auth = {
      issueSession: () =>
        Effect.suspend(() => {
          attempts += 1;
          return attempts < 3
            ? Effect.fail(new BusyError())
            : Effect.succeed({ token: "token", sessionId: "session" as never });
        }),
      revokeSession: () =>
        Effect.sync(() => {
          revoked = true;
          return true;
        }),
    } as never;

    const token = yield* withSidebandSession(auth, (issuedToken) => Effect.succeed(issuedToken));

    assert.strictEqual(token, "token");
    assert.strictEqual(attempts, 3);
    assert.isTrue(revoked);
  }),
);
