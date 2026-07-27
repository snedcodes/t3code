#!/usr/bin/env node

import { spawnSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir, platform } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const home = homedir();
const profileHome = join(home, ".t3-operational");
const databasePath = join(profileHome, "userdata", "state.sqlite");
const appData =
  platform() === "darwin" ? join(home, "Library", "Application Support") : join(home, ".config");
const userDataDirectory = join(appData, "t3code-operational");
const legacyUserDataDirectory = join(appData, "T3 Code (Operational)");
const legacyHome = join(home, ".t3");
const legacyDatabasePath = join(legacyHome, "userdata", "state.sqlite");
const appUserModelId = "com.t3tools.t3code.operational";
const port = 3774;
const webPort = 5174;
const node24Candidates = [
  process.env.T3_OPERATIONAL_NODE,
  "/tmp/t3-diffs-repair-toolchain/node/bin/node",
  "/opt/homebrew/opt/node@24/bin/node",
  "/usr/local/opt/node@24/bin/node",
  "node",
  process.execPath,
].filter(Boolean);

function readOnly(command, args) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  return result.status === 0 ? result.stdout.trim() : "";
}

function listener(portNumber) {
  const output = readOnly("lsof", ["-nP", `-iTCP:${portNumber}`, "-sTCP:LISTEN", "-Fpc"]);
  if (!output) return null;
  let pid = null;
  let command = null;
  for (const field of output.split("\n")) {
    if (field.startsWith("p")) pid = Number.parseInt(field.slice(1), 10);
    if (field.startsWith("c")) command = field.slice(1);
  }
  return Number.isInteger(pid) ? { pid, command } : null;
}

function pathOwners(path) {
  const output = readOnly("lsof", ["-nP", "-Fpc", "--", path]);
  if (!output) return [];
  let pid = null;
  let command = null;
  for (const field of output.split("\n")) {
    if (field.startsWith("p")) pid = Number.parseInt(field.slice(1), 10);
    if (field.startsWith("c")) command = field.slice(1);
  }
  return Number.isInteger(pid) ? [{ pid, command, path }] : [];
}

export function resolveOperationalProfile() {
  return {
    name: "T3 Operational",
    home: profileHome,
    database: databasePath,
    appUserModelId,
    userDataDirectory,
    legacyUserDataDirectory,
    port,
    webPort,
  };
}

export function diagnose() {
  const profile = resolveOperationalProfile();
  const conflicts = [];
  const legacyPortOwner = listener(3773);
  const legacyDatabaseOwners = pathOwners(legacyDatabasePath);
  const operationalPortOwner = listener(port);
  const operationalDatabaseOwners = pathOwners(databasePath);
  if (legacyPortOwner)
    conflicts.push(`legacy T3 listener is active on 3773 (pid ${legacyPortOwner.pid})`);
  if (legacyDatabaseOwners.length > 0)
    conflicts.push(
      `legacy database is open (pid ${legacyDatabaseOwners.map((owner) => owner.pid).join(", ")})`,
    );
  if (operationalPortOwner)
    conflicts.push(`operational port ${port} is already in use (pid ${operationalPortOwner.pid})`);
  if (operationalDatabaseOwners.length > 0)
    conflicts.push(
      `operational database is already open (pid ${operationalDatabaseOwners.map((owner) => owner.pid).join(", ")})`,
    );
  if (!existsSync(databasePath)) conflicts.push(`operational database is missing: ${databasePath}`);
  return {
    ok: conflicts.length === 0,
    conflicts,
    profile,
    legacy: {
      home: legacyHome,
      database: legacyDatabasePath,
      listener: legacyPortOwner,
      databaseOwners: legacyDatabaseOwners,
    },
    operational: { listener: operationalPortOwner, databaseOwners: operationalDatabaseOwners },
  };
}

function printDiagnosis(result) {
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok)
    console.error(
      `T3 Operational launch refused:\n${result.conflicts.map((conflict) => `- ${conflict}`).join("\n")}`,
    );
}

export function resolveNode24() {
  for (const candidate of node24Candidates) {
    const version = readOnly(candidate, ["--version"]);
    if (Number.parseInt(version.slice(1), 10) >= 24) return { path: candidate, version };
  }
  return null;
}

const selectedNode = resolveNode24();
const nodeRemediation =
  "Node 24 was not found. Install/expose Node 24 or set T3_OPERATIONAL_NODE to its executable.";

function help() {
  console.log(
    `T3 Operational (checkout desktop build)\n\nUsage:\n  Double-click this launcher after closing legacy T3.\n  T3 Operational.command --diagnose\n\nThis starts the separate desktop build from this checkout using /Users/snedmusic/.t3-operational. It is not the installed nightly app and is not an Applications bundle yet.`,
  );
}

if (process.argv.includes("--help")) {
  help();
  process.exit(0);
}

if (process.argv.includes("--diagnose")) {
  const result = diagnose();
  result.node = selectedNode;
  if (!selectedNode) {
    result.conflicts.push(nodeRemediation);
    result.ok = false;
  }
  printDiagnosis(result);
  process.exit(result.ok ? 0 : 2);
}

const result = diagnose();
result.node = selectedNode;
if (!selectedNode) {
  result.conflicts.push(nodeRemediation);
  printDiagnosis(result);
  process.exit(2);
}
if (!result.ok) {
  printDiagnosis(result);
  process.exit(2);
}

const env = {
  ...process.env,
  T3CODE_HOME: profileHome,
  T3CODE_PORT: String(port),
  T3CODE_DESKTOP_APP_USER_MODEL_ID: appUserModelId,
  T3CODE_DESKTOP_USER_DATA_DIR_NAME: "t3code-operational",
  T3CODE_DESKTOP_LEGACY_USER_DATA_DIR_NAME: "T3 Code (Operational)",
  T3CODE_AUTO_BOOTSTRAP_PROJECT_FROM_CWD: "0",
};
delete env.VITE_DEV_SERVER_URL;
delete env.T3CODE_DESKTOP_WS_URL;

console.log(
  `Starting ${result.profile.name}: home=${profileHome} db=${databasePath} app=${appUserModelId} port=${port}`,
);
const child = spawn(
  selectedNode.path,
  [
    join(repoRoot, "scripts", "dev-runner.ts"),
    "dev:desktop",
    "--home-dir",
    profileHome,
    "--port",
    String(port),
    "--dev-url",
    `http://127.0.0.1:${webPort}`,
  ],
  { cwd: repoRoot, env, stdio: "inherit" },
);
let shuttingDown = false;
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (shuttingDown) return;
    shuttingDown = true;
    child.kill(signal);
  });
}
child.on("exit", (code, signal) => {
  const after = diagnose();
  if (after.operational.listener || after.operational.databaseOwners.length > 0)
    console.error("T3 Operational exited with runtime ownership still present.");
  else console.log("T3 Operational exited cleanly; no listener or database owner remains.");
  process.exit(signal ? 130 : (code ?? 1));
});
