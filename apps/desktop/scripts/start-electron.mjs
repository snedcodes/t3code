import * as NodeChildProcess from "node:child_process";

import { desktopDir, resolveElectronLaunchCommand } from "./electron-launcher.mjs";
import { assertIsolationPreflight } from "./isolation-preflight.mjs";

const childEnv = { ...process.env };
delete childEnv.ELECTRON_RUN_AS_NODE;

const isolation = assertIsolationPreflight({ env: childEnv });
console.log(
  `[t3] isolation preflight passed: app=${isolation.profile.appUserModelId} home=${isolation.profile.t3Home} db=${isolation.profile.databasePath} port=${isolation.profile.port}`,
);

const electronCommand = resolveElectronLaunchCommand(["dist-electron/main.cjs"]);
const child = NodeChildProcess.spawn(electronCommand.electronPath, electronCommand.args, {
  stdio: "inherit",
  cwd: desktopDir,
  env: childEnv,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
