import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

export const PRODUCTION_PROFILE = Object.freeze({
  appUserModelId: "com.t3tools.t3code",
  port: 3773,
});

function defaultAppDataDirectory({ homeDirectory, platform }) {
  if (platform === "darwin") {
    return NodePath.join(homeDirectory, "Library", "Application Support");
  }
  if (platform === "win32") {
    return NodePath.join(homeDirectory, "AppData", "Roaming");
  }
  return NodePath.join(homeDirectory, ".config");
}

function normalizePath(value) {
  return NodePath.resolve(value);
}

function pathsOverlap(left, right) {
  const normalizedLeft = normalizePath(left);
  const normalizedRight = normalizePath(right);
  return (
    normalizedLeft === normalizedRight ||
    normalizedLeft.startsWith(`${normalizedRight}${NodePath.sep}`) ||
    normalizedRight.startsWith(`${normalizedLeft}${NodePath.sep}`)
  );
}

function parsePort(rawPort) {
  const port = Number.parseInt(rawPort ?? "", 10);
  return Number.isInteger(port) && port > 0 && port <= 65535 ? port : null;
}

export function resolveIsolationProfile({
  env = process.env,
  homeDirectory = NodeOS.homedir(),
  // oxlint-disable-next-line t3code/no-global-process-runtime -- Standalone preflight has no Effect runtime.
  platform = NodeOS.platform(),
  appDataDirectory = defaultAppDataDirectory({ homeDirectory, platform }),
} = {}) {
  const configuredHome = env.T3CODE_HOME?.trim();
  const t3Home = configuredHome ? normalizePath(configuredHome) : null;
  const port = parsePort(env.T3CODE_PORT);
  const appUserModelId = env.T3CODE_DESKTOP_APP_USER_MODEL_ID?.trim() || "com.t3tools.t3code.dev";
  const userDataDirectory = normalizePath(
    NodePath.join(appDataDirectory, env.T3CODE_DESKTOP_USER_DATA_DIR_NAME?.trim() || "t3code-dev"),
  );
  const legacyUserDataDirectory = normalizePath(
    NodePath.join(
      appDataDirectory,
      env.T3CODE_DESKTOP_LEGACY_USER_DATA_DIR_NAME?.trim() || "T3 Code (Dev)",
    ),
  );
  const databasePath = t3Home ? NodePath.join(t3Home, "userdata", "state.sqlite") : null;

  return {
    appName: "T3 Code (Dev)",
    appUserModelId,
    t3Home,
    userDataDirectory,
    legacyUserDataDirectory,
    port,
    databasePath,
    databaseFamily: databasePath
      ? [databasePath, `${databasePath}-wal`, `${databasePath}-shm`]
      : [],
  };
}

export function validateIsolationProfile(profile, production = {}) {
  const productionHome = normalizePath(production.t3Home || NodePath.join(NodeOS.homedir(), ".t3"));
  const productionUserData = normalizePath(
    production.userDataDirectory ||
      NodePath.join(
        // oxlint-disable-next-line t3code/no-global-process-runtime -- Standalone preflight has no Effect runtime.
        defaultAppDataDirectory({ homeDirectory: NodeOS.homedir(), platform: NodeOS.platform() }),
        "t3code",
      ),
  );
  const productionDatabase = normalizePath(
    production.databasePath || NodePath.join(productionHome, "userdata", "state.sqlite"),
  );
  const productionDatabaseFamily = new Set([
    productionDatabase,
    `${productionDatabase}-wal`,
    `${productionDatabase}-shm`,
  ]);
  const conflicts = [];

  if (!profile.t3Home) {
    conflicts.push("T3CODE_HOME must be explicit for an isolated desktop launch");
  } else if (pathsOverlap(profile.t3Home, productionHome)) {
    conflicts.push(`T3CODE_HOME overlaps production: ${profile.t3Home}`);
  }

  if (profile.appUserModelId === (production.appUserModelId || PRODUCTION_PROFILE.appUserModelId)) {
    conflicts.push(`app user model ID is production identity: ${profile.appUserModelId}`);
  }

  if (profile.port === null) {
    conflicts.push("T3CODE_PORT must be an explicit integer between 1 and 65535");
  } else if (profile.port === (production.port || PRODUCTION_PROFILE.port)) {
    conflicts.push(`port is production port: ${profile.port}`);
  }

  if (pathsOverlap(profile.userDataDirectory, productionUserData)) {
    conflicts.push(`Electron userData overlaps production: ${profile.userDataDirectory}`);
  }
  if (pathsOverlap(profile.legacyUserDataDirectory, productionUserData)) {
    conflicts.push(
      `legacy Electron userData overlaps production: ${profile.legacyUserDataDirectory}`,
    );
  }

  if (!profile.databasePath) {
    conflicts.push("database path cannot be resolved without T3CODE_HOME");
  } else if (profile.databaseFamily.some((candidate) => productionDatabaseFamily.has(candidate))) {
    conflicts.push(`database family overlaps production: ${profile.databasePath}`);
  }

  return {
    ok: conflicts.length === 0,
    conflicts,
    production: {
      appUserModelId: production.appUserModelId || PRODUCTION_PROFILE.appUserModelId,
      t3Home: productionHome,
      userDataDirectory: productionUserData,
      databasePath: productionDatabase,
      port: production.port || PRODUCTION_PROFILE.port,
    },
  };
}

function runReadOnly(command, args) {
  const result = NodeChildProcess.spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  return result.status === 0 ? result.stdout.trim() : "";
}

function readListenerOwner(port) {
  if (port === null) return null;
  const output = runReadOnly("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-Fpc"]);
  if (!output) return null;
  const fields = output.split("\n");
  let pid = null;
  let command = null;
  for (const field of fields) {
    if (field.startsWith("p")) pid = Number.parseInt(field.slice(1), 10);
    if (field.startsWith("c")) command = field.slice(1);
  }
  return Number.isInteger(pid) ? { pid, command } : null;
}

function readPathOwners(paths) {
  const owners = new Map();
  for (const path of paths) {
    const output = runReadOnly("lsof", ["-nP", "-Fpc", "--", path]);
    if (!output) continue;
    let pid = null;
    let command = null;
    for (const field of output.split("\n")) {
      if (field.startsWith("p")) pid = Number.parseInt(field.slice(1), 10);
      if (field.startsWith("c")) command = field.slice(1);
    }
    if (Number.isInteger(pid)) owners.set(`${path}:${pid}`, { path, pid, command });
  }
  return [...owners.values()];
}

export function collectIsolationDiagnostics(profile) {
  const listenerOwner = readListenerOwner(profile.port);
  const databaseOwners = readPathOwners(profile.databaseFamily);
  return {
    backendPid: null,
    listenerOwner,
    databaseOwners,
    lock: {
      userDataDirectory: profile.userDataDirectory,
      lockFiles: [
        NodePath.join(profile.userDataDirectory, "SingletonLock"),
        NodePath.join(profile.legacyUserDataDirectory, "SingletonLock"),
      ],
      exists:
        NodeFS.existsSync(NodePath.join(profile.userDataDirectory, "SingletonLock")) ||
        NodeFS.existsSync(NodePath.join(profile.legacyUserDataDirectory, "SingletonLock")),
    },
  };
}

export function runIsolationPreflight({ env = process.env, production } = {}) {
  const profile = resolveIsolationProfile({ env });
  const validation = validateIsolationProfile(profile, production);
  const diagnostics = collectIsolationDiagnostics(profile);

  if (diagnostics.listenerOwner) {
    validation.conflicts.push(
      `isolated port is already listened to by pid ${diagnostics.listenerOwner.pid} (${diagnostics.listenerOwner.command || "unknown"})`,
    );
  }
  if (diagnostics.databaseOwners.length > 0) {
    validation.conflicts.push(
      `isolated database family is already open by ${diagnostics.databaseOwners.map((owner) => owner.pid).join(", ")}`,
    );
  }
  if (diagnostics.lock.exists) {
    validation.conflicts.push("isolated Electron userData has an existing SingletonLock");
  }
  validation.ok = validation.conflicts.length === 0;

  return { profile, validation, diagnostics };
}

export function assertIsolationPreflight(options = {}) {
  const result = runIsolationPreflight(options);
  if (!result.validation.ok) {
    throw new Error(
      [
        "T3 isolated development launch refused.",
        ...result.validation.conflicts.map((conflict) => `- ${conflict}`),
        `Resolved profile: ${JSON.stringify(result.profile)}`,
      ].join("\n"),
    );
  }
  return result;
}
