import { spawn } from "node:child_process";
import { watch } from "node:fs";
import { fileURLToPath } from "node:url";

// Keep source reloads and crash recovery under one owner. Node --watch alone
// waits indefinitely after its application crashes.
const server = fileURLToPath(new URL("../", import.meta.url));
const roots = [new URL("../src/", import.meta.url), new URL("../../../packages/", import.meta.url)];
let child;
let stopping = false;
let restartTimer;
let reloadTimer;

function start() {
  if (stopping) return;
  child = spawn(process.execPath, ["src/bin.ts"], { cwd: server, stdio: "inherit", windowsHide: true });
  console.log(`[dev-supervisor] backend pid=${child.pid}`);
  child.once("error", (error) => console.error(`[dev-supervisor] spawn failed: ${error.message}`));
  child.once("close", (code, signal) => {
    child = undefined;
    if (!stopping) {
      console.error(`[dev-supervisor] backend exited code=${code} signal=${signal}; restarting`);
      restartTimer = setTimeout(start, 1000);
    }
  });
}

const watchers = roots.map((root) => watch(root, { recursive: true }, (_event, filename) => {
  if (!filename || /(^|[\\/])(node_modules|dist|\.git)([\\/]|$)/.test(filename)) return;
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => {
    if (child) child.kill("SIGTERM");
  }, 200);
}));

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    stopping = true;
    clearTimeout(restartTimer);
    clearTimeout(reloadTimer);
    for (const watcher of watchers) watcher.close();
    if (child) child.kill(signal);
  });
}
start();
