import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("Windows nonzero child exit survives synchronous taskkill launch failure", {
  skip: process.platform !== "win32",
}, () => {
  // Exercise the installed adapter's real exit event, rather than a copy of
  // the helper: an escaping exception here terminates the fixture process.
  const fixture = `
    import cp from 'node:child_process';
    import { syncBuiltinESMExports } from 'node:module';
    import { Effect } from 'effect';
    import * as NodeServices from '@effect/platform-node/NodeServices';
    import { ChildProcess } from 'effect/unstable/process';
    let cleanupCalls = 0;
    cp.execFile = () => { cleanupCalls++; throw Object.assign(new Error('spawn UNKNOWN'), {code:'UNKNOWN'}); };
    syncBuiltinESMExports();
    const code = await Effect.runPromise(Effect.gen(function*() {
      const child = yield* ChildProcess.make(process.execPath, ['-e', 'process.exit(7)']);
      return yield* child.exitCode;
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)));
    if (code !== 7 || cleanupCalls < 1) throw new Error('Cleanup path was not exercised');
    console.log('cleanup failure contained; exitCode=' + code);
  `;
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", fixture], {
    cwd: new URL("../", import.meta.url), encoding: "utf8", timeout: 30000, windowsHide: true,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /cleanup failure contained; exitCode=7/);
});
