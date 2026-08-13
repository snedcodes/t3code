import { assert, it } from "@effect/vitest";

import {
  buildRemoteSidebandCommand,
  quoteRemoteShellArgument,
  resolveSidebandSshHostAlias,
  SidebandSshHostAliasError,
} from "./sidebandSsh.ts";

it("accepts only documented owning-host aliases", () => {
  assert.strictEqual(resolveSidebandSshHostAlias("agent-win-vps"), "agent-win-vps");
  assert.throws(() => resolveSidebandSshHostAlias("vps.example.test"), SidebandSshHostAliasError);
});

it("quotes remote shell values without interpolating them", () => {
  assert.strictEqual(quoteRemoteShellArgument("it's safe"), "'it'\"'\"'s safe'");
  const command = buildRemoteSidebandCommand({
    project: "VoiceToolsSuite",
    title: "Coordinator; $(bad)",
    message: "hello ' && rm -rf / #",
  });
  assert.strictEqual(
    command,
    "exec t3 sideband-send --json --project 'VoiceToolsSuite' --title 'Coordinator; $(bad)' 'hello '\"'\"' && rm -rf / #'",
  );
});
