#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";

const officialRepository = "https://github.com/pingdotgg/t3code.git";
const prereleaseId = "(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)";
const releasePattern = new RegExp(
  `^v(?:0|[1-9][0-9]*)\\.(?:0|[1-9][0-9]*)\\.(?:0|[1-9][0-9]*)(?:-${prereleaseId}(?:\\.${prereleaseId})*)?$`,
);
const liveDirectories = new Set([".t3", ".t3-dev", ".t3-private-context"]);
const disabledHooksPath = path.join(tmpdir(), `t3-upgrade-no-hooks-${randomUUID()}`);
let checkpoint = {};

function exists(filename) {
  try {
    lstatSync(filename);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

// Resolve existing ancestors so a symlink cannot place a new worktree inside live state.
function canonicalDestination(filename) {
  let ancestor = filename;
  const suffix = [];
  while (!exists(ancestor)) {
    suffix.unshift(path.basename(ancestor));
    const parent = path.dirname(ancestor);
    if (parent === ancestor) throw new Error("Workspace has no accessible existing ancestor.");
    ancestor = parent;
  }
  return path.join(realpathSync(ancestor), ...suffix);
}

function inside(parent, child) {
  const relative = path.relative(parent, child);
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))
  );
}

function git(repo, args, allowFailure = false) {
  const result = spawnSync(
    "git",
    ["-c", `core.hooksPath=${disabledHooksPath}`, "-C", repo, ...args],
    {
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 8 * 1024 * 1024,
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: "0",
        GIT_MERGE_AUTOEDIT: "no",
        GIT_NO_REPLACE_OBJECTS: "1",
      },
    },
  );
  // Remote stderr can contain authenticated URLs; publish only a fixed operation failure.
  if (result.error || result.status === null) throw new Error(`Git ${args[0]} could not run.`);
  if (result.status !== 0 && !allowFailure)
    throw new Error(`Git ${args[0]} failed (exit ${result.status}).`);
  return { status: result.status, output: result.stdout.trim(), raw: result.stdout };
}

function parseOptions() {
  const options = {};
  const valued = new Set(["line", "release", "workspace", "repo", "manifest"]);
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i += 1) {
    const key = args[i].startsWith("--") ? args[i].slice(2) : "";
    if (Object.hasOwn(options, key)) throw new Error("Duplicate command option.");
    if (key === "inspect") options.inspect = true;
    else if (valued.has(key) && args[i + 1] && !args[i + 1].startsWith("--"))
      options[key] = args[++i];
    else
      throw new Error(
        "Use --line desktop|mobile-vps --release <officialtag> --workspace <new absolute path> [--repo <gitcheckout>] [--manifest <path>] [--inspect].",
      );
  }
  if (!["desktop", "mobile-vps"].includes(options.line))
    throw new Error("Select desktop or mobile-vps.");
  if (!releasePattern.test(options.release ?? ""))
    throw new Error(
      "Release must be an exact v-prefixed numeric semver tag, optionally with a prerelease.",
    );
  if (!options.workspace || !path.isAbsolute(options.workspace))
    throw new Error("Workspace must be a new absolute path.");
  return options;
}

function main() {
  const options = parseOptions();
  const checkout = path.resolve(
    options.repo ?? path.join(path.dirname(fileURLToPath(import.meta.url)), ".."),
  );
  const repo = realpathSync(git(checkout, ["rev-parse", "--show-toplevel"]).output);
  const workspace = path.resolve(options.workspace);
  if (exists(workspace)) throw new Error("Workspace already exists; it will not be overwritten.");
  const canonicalWorkspace = canonicalDestination(workspace);
  if (inside(repo, canonicalWorkspace))
    throw new Error("Workspace must be outside the supplied repository.");
  for (const candidate of [workspace, canonicalWorkspace]) {
    if (candidate.split(/[\\/]+/).some((part) => liveDirectories.has(part.toLowerCase()))) {
      throw new Error(
        "Workspace must be outside live .t3, .t3-dev and .t3-private-context directories.",
      );
    }
  }
  const manifestPath = path.resolve(
    options.manifest ?? path.join(repo, "scripts", "t3-dev-release-manifest.json"),
  );
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (manifest.schemaVersion !== 1 || manifest.upstream?.repository !== officialRepository)
    throw new Error("Unsupported manifest schema or official repository.");
  const baseline = manifest.sourceLines?.[options.line];
  if (
    !baseline ||
    baseline.forkRemote !== "origin" ||
    !releasePattern.test(baseline.upstreamTag ?? "") ||
    !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(baseline.forkCommit ?? "") ||
    !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(baseline.upstreamCommit ?? "") ||
    typeof baseline.forkBranch !== "string" ||
    !Array.isArray(baseline.capabilities) ||
    !baseline.capabilities.every((value) => typeof value === "string" && value.length > 0)
  ) {
    throw new Error("Selected source line has an invalid accepted baseline.");
  }
  git(repo, ["check-ref-format", `refs/heads/${baseline.forkBranch}`]);
  const plan = {
    line: options.line,
    release: options.release,
    repo,
    workspace,
    manifest: manifestPath,
    baseline: {
      upstreamTag: baseline.upstreamTag,
      upstreamCommit: baseline.upstreamCommit,
      forkCommit: baseline.forkCommit,
      forkBranch: baseline.forkBranch,
      forkRemote: "origin",
    },
    requiredRetainedCapabilities: baseline.capabilities,
    runtimeProof: "pending",
  };
  checkpoint = plan;
  if (options.inspect) {
    console.log(
      JSON.stringify({
        ...plan,
        status: "inspection-only",
        steps: [
          "Verify accepted fork commit; fetch its named origin branch only if commit absent.",
          "Verify accepted fork commit is reachable from its named branch.",
          "Fetch exact official tag into a unique task ref and resolve its commit.",
          "Create a new branch/worktree at accepted fork commit; merge official commit --no-ff --no-commit.",
          "Leave candidate or conflicts intact for root review, focused checks and manual commit.",
        ],
      }),
    );
    return;
  }
  if (git(repo, ["cat-file", "-e", `${baseline.forkCommit}^{commit}`], true).status !== 0) {
    git(repo, [
      "fetch",
      "--no-tags",
      "origin",
      `refs/heads/${baseline.forkBranch}:refs/remotes/origin/${baseline.forkBranch}`,
    ]);
  }
  const forkCommit = git(repo, ["rev-parse", "--verify", `${baseline.forkCommit}^{commit}`]).output;
  if (forkCommit.toLowerCase() !== baseline.forkCommit.toLowerCase())
    throw new Error("Manifest forkCommit must identify the exact commit, not a tag object.");
  const namedRefs = [
    `refs/heads/${baseline.forkBranch}`,
    `refs/remotes/origin/${baseline.forkBranch}`,
  ];
  if (
    !namedRefs.some(
      (ref) => git(repo, ["merge-base", "--is-ancestor", forkCommit, ref], true).status === 0,
    )
  ) {
    throw new Error("Accepted fork commit is not reachable from the recorded local/origin branch.");
  }
  const taskId = randomUUID();
  const upstreamRef = `refs/t3-dev-upgrades/${options.line}/${options.release}/${taskId}`;
  const branch = `sned/${options.line}-upgrade-${options.release}-${taskId}`;
  git(repo, [
    "fetch",
    "--no-tags",
    officialRepository,
    `refs/tags/${options.release}:${upstreamRef}`,
  ]);
  const upstreamCommit = git(repo, ["rev-parse", "--verify", `${upstreamRef}^{commit}`]).output;
  checkpoint = { ...plan, forkCommit, upstreamCommit, upstreamRef, branch };
  // Worktree add itself refuses existing paths; no deletion/reset/cleanup is performed.
  if (exists(workspace))
    throw new Error("Workspace appeared during preparation; refusing to overwrite.");
  git(repo, ["worktree", "add", "-b", branch, workspace, forkCommit]);
  const merge = git(
    workspace,
    [
      "-c",
      "merge.autoStash=false",
      "-c",
      "rerere.enabled=false",
      "-c",
      "rerere.autoupdate=false",
      "merge",
      "--no-ff",
      "--no-commit",
      upstreamCommit,
    ],
    true,
  );
  const unmergedPaths = git(workspace, ["diff", "--name-only", "--diff-filter=U", "-z"])
    .raw.split("\0")
    .filter(Boolean);
  const status = unmergedPaths.length
    ? "needs-resolution"
    : merge.status === 0
      ? "candidate-needs-review"
      : "preparation-failed";
  console.log(
    JSON.stringify({
      ...plan,
      forkCommit,
      upstreamCommit,
      upstreamRef,
      branch,
      status,
      mergePending: git(workspace, ["rev-parse", "--verify", "MERGE_HEAD"], true).status === 0,
      unmergedPaths,
    }),
  );
  if (status === "needs-resolution") process.exitCode = 2;
  else if (status === "preparation-failed") process.exitCode = 1;
}

try {
  main();
} catch (error) {
  console.error(
    JSON.stringify({ ...checkpoint, status: "preparation-failed", error: error.message }),
  );
  process.exitCode = 1;
}
