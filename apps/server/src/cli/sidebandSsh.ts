import { HostProcessPlatform } from "@t3tools/shared/hostProcess";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { Argument, Command, Flag } from "effect/unstable/cli";

import * as ProcessRunner from "../processRunner.ts";

/** The six-direction SSH standard names only these three owning-host aliases. */
export const SIDEBAND_SSH_HOST_ALIASES = [
  "agent-macbook",
  "agent-win-laptop",
  "agent-win-vps",
] as const;

export type SidebandSshHostAlias = (typeof SIDEBAND_SSH_HOST_ALIASES)[number];

export class SidebandSshHostAliasError extends Error {
  constructor(readonly alias: string) {
    super(`'${alias}' is not a documented sideband SSH host alias.`);
  }
}

export class SidebandSshRemoteError extends Error {
  constructor(
    readonly alias: string,
    readonly exitCode: number | null,
    readonly stderr: string,
  ) {
    super(`Remote sideband dispatch failed on '${alias}'.`);
  }
}

export const resolveSidebandSshHostAlias = (alias: string): SidebandSshHostAlias => {
  if ((SIDEBAND_SSH_HOST_ALIASES as ReadonlyArray<string>).includes(alias)) {
    return alias as SidebandSshHostAlias;
  }
  throw new SidebandSshHostAliasError(alias);
};

/** Quote one value for the remote POSIX shell; no untrusted value is concatenated unquoted. */
export const quoteRemoteShellArgument = (value: string) => `'${value.replaceAll("'", "'\"'\"'")}'`;

export const buildRemoteSidebandCommand = (input: {
  readonly project: string;
  readonly title: string;
  readonly message: string;
}) =>
  [
    "exec t3 sideband-send --json",
    "--project",
    quoteRemoteShellArgument(input.project),
    "--title",
    quoteRemoteShellArgument(input.title),
    quoteRemoteShellArgument(input.message),
  ].join(" ");

type SidebandSshFlags = {
  readonly host: string;
  readonly project: string;
  readonly title: string;
  readonly message: string;
  readonly json: boolean;
};

const runSidebandSsh = Effect.fn("runSidebandSsh")(function* (flags: SidebandSshFlags) {
  const host = resolveSidebandSshHostAlias(flags.host);
  const platform = yield* HostProcessPlatform;
  const runner = yield* ProcessRunner.ProcessRunner;
  const result = yield* runner.run({
    command: platform === "win32" ? "ssh.exe" : "ssh",
    args: [host, buildRemoteSidebandCommand(flags)],
    timeout: "30 seconds",
    maxOutputBytes: 64 * 1024,
  });
  if (result.code !== 0 || result.timedOut) {
    return yield* new SidebandSshRemoteError(host, result.code, result.stderr);
  }
  const receipt = result.stdout.trim();
  if (receipt.length === 0) {
    return yield* new SidebandSshRemoteError(host, result.code, result.stderr);
  }
  if (flags.json) {
    yield* Console.log(receipt);
    return;
  }
  yield* Console.log(`Remote ${host} receipt:\n${receipt}`);
});

export const sidebandSshCommand = Command.make("sideband-send-ssh", {
  host: Flag.string("host").pipe(Flag.withDescription("Documented owning-host SSH alias.")),
  project: Flag.string("project").pipe(
    Flag.withDescription("Exact visible project title on the remote host."),
  ),
  title: Flag.string("title").pipe(
    Flag.withDescription("Exact visible T3 thread title on the remote host."),
  ),
  message: Argument.string("message").pipe(
    Argument.withDescription("User message to dispatch remotely."),
  ),
  json: Flag.boolean("json").pipe(Flag.withDefault(false)),
}).pipe(
  Command.withDescription("Invoke native sideband dispatch on a documented remote owning host."),
  Command.withHandler((flags) => runSidebandSsh(flags).pipe(Effect.provide(ProcessRunner.layer))),
);
