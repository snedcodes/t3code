import { assert, it } from "@effect/vitest";

import {
  buildRemoteSidebandCommand,
  quoteRemotePosixShellArgument,
  quoteRemotePowerShellArgument,
  resolveSidebandSshHostAlias,
  SidebandSshHostAliasError,
} from "./sidebandSsh.ts";

it("accepts only documented owning-host aliases", () => {
  assert.strictEqual(resolveSidebandSshHostAlias("agent-win-vps"), "agent-win-vps");
  assert.throws(() => resolveSidebandSshHostAlias("vps.example.test"), SidebandSshHostAliasError);
});

it("uses POSIX quoting for the Mac owning host", () => {
  assert.strictEqual(quoteRemotePosixShellArgument("it's safe"), "'it'\"'\"'s safe'");
  assert.strictEqual(
    buildRemoteSidebandCommand({
      host: "agent-macbook",
      project: "T3 Code Reliability",
      title: "Portfolio Overseer",
      message: "hello ' safely",
    }),
    "exec t3 sideband-send --json --project 'T3 Code Reliability' --title 'Portfolio Overseer' 'hello '\"'\"' safely'",
  );
});

it("encodes Windows PowerShell arguments without interpolating them", () => {
  assert.strictEqual(quoteRemotePowerShellArgument("it's safe"), "'it''s safe'");
  const command = buildRemoteSidebandCommand({
    host: "agent-win-vps",
    project: "VoiceToolsSuite",
    title: "Coordinator; $(bad)",
    message: "hello ' && rm -rf / #",
  });
  const encoded = command.match(/-EncodedCommand ([A-Za-z0-9+/=]+)$/)?.[1];
  assert.isString(encoded);
  assert.strictEqual(
    Buffer.from(encoded!, "base64").toString("utf16le"),
    "t3 sideband-send --json --project 'VoiceToolsSuite' --title 'Coordinator; $(bad)' 'hello '' && rm -rf / #'",
  );
});
