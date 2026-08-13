# Native T3 Sideband: Cross-Host Release

## Outcome

Ordinary agent coordination works through native T3 even when VoiceTools is
unavailable. A sender addresses an agent by its exact visible project and title;
the owning host resolves and dispatches the message through its local T3
orchestration server. SSH is transport only.

## Starting point

- Local implementation: commits `0551ad327`, `0b8bdef85`, and `656e9026b`.
- Local exact-title dispatch has already produced a normal orchestration
  receipt.
- The remote T3 installations do not yet contain the `sideband-send` command.
- A later local invocation exposed a real defect: the standalone CLI tried to
  write an administrative auth session into `state.sqlite` and hit a database
  lock. Native sideband must obtain its short-lived credential through the
  already-running local T3 server's supported auth surface, or otherwise share
  the server's normal serialization path. It must not open a competing local
  persistence writer and retry blindly.

## Scope

1. Repair the locked-local-auth path with a focused test that demonstrates the
   CLI does not compete with the live server for `state.sqlite`.
2. Inspect the three current sideband commits and focused tests.
2. Run only focused server checks needed for `sideband.ts` and `sidebandSsh.ts`.
3. Push the coherent reliability branch to the user fork; do not merge upstream
   or change official release tracking in this tranche.
4. Build and deploy the same reviewed T3 fork artifact to one non-critical
   remote host at a time through its documented owning-host route.
5. Prove one exact-title Mac-to-Windows and one Windows-to-Mac dispatch using
   `t3 sideband-send-ssh`, with the receiving thread's normal T3 receipt.
6. Record the installed source revision and both receipts in this plan or a
   short adjacent release receipt.

## Required behavior

```text
exact project + exact visible title
  -> local native T3 snapshot resolves exactly once
  -> normal local orchestration dispatch
  -> standard receipt

other host
  -> documented SSH alias
  -> same command executes on owning host
  -> owning host resolves and dispatches
  -> remote receipt returned unchanged
```

Unknown or duplicate titles stop. Callers never supply a thread ID. Do not edit
T3 SQLite, create a broker, add polling, or fall back to VoiceTools sending.

## Deployment sequence

1. Produce one immutable artifact/revision from the clean committed fork.
2. Install it on one non-critical Windows host without changing T3 user data.
3. Confirm `t3 sideband-send --help` and `t3 sideband-send-ssh --help` on that
   host. Do not claim cross-host readiness from a local build alone.
4. Dispatch one neutral message to an existing exact-title target on that host.
5. Deploy to the other Windows host and repeat in the opposite direction.
6. Only after both directions work, update operational instructions to name
   native sideband as the ordinary coordination path.

## Protected boundaries

- Do not alter VoiceTools backend, Portfolio state, phone features, or T3
  mobile in this tranche.
- Do not touch unrelated dirty files or existing T3 production user data.
- Do not resend an ambiguous/uncertain dispatch. Read the receipt first.
- A temporary SQLite lock is a native sideband repair signal, not authorization
  to fall back to VoiceTools for ordinary agent coordination.
- If a deployment needs a service restart or an installed-app replacement,
  use that host's documented owner and keep the prior artifact available for
  rollback.

## Acceptance

- Focused tests/checks pass.
- Same source revision runs locally and on both required remote hosts.
- One exact-title cross-host send succeeds in each direction with normal
  dispatch receipt evidence.
- VoiceTools can be unavailable without invalidating the proof.

## Handoff

Commit only files owned by this tranche. Report the fork commit, deployed
revision per host, focused validation, both receipts, and any remaining host
whose installed T3 is not yet compatible.

## Execution receipt — 2026-08-13

- Fork source revision: `ba8f77bea074925f47bb8498e4e50c8e5e7c0079`.
- Final server artifact: `apps/server/dist/bin.mjs`, SHA-256
  `8ed123f2fbe16d04e20c2850068dea4a748bfe9ad4a7297d2a53a30c780fe48a`.
- `agent-win-vps`: installed at the npm T3 bundle path; `sideband-send` and
  `sideband-send-ssh` help pass; rollback copy retained; no service restart.
- `agent-win-laptop`: installed at the app-unpacked server path; both help
  commands pass through the reversible Node 22 wrapper; rollback copy retained;
  no service restart.
- Mac-to-Windows VPS receipt: exact project `REPEATER_2026`, exact title
  `Repeater Coordinator`, sequence `117643`, status `dispatched`, transcript
  `{ acceptedUserMessage: true, receipt: "native-orchestration-dispatch" }`.
- The first VPS attempt failed before dispatch because the Windows SSH shell
  cannot execute POSIX quoting; read-only verification found no message, so it
  was not resent until the host-aware PowerShell transport fix was installed.
- Windows-to-Mac proof is protected and incomplete: documented SSH alias
  `agent-macbook` does not resolve from the rollout host, and no Mac-side T3
  CLI route is currently available through that alias. No undocumented alias,
  manual thread ID, Portfolio target, or VoiceTools fallback was used.

## Current state — 2026-08-13 follow-up

The tranche is not complete. The VPS receipt above proves only Mac-to-Windows
VPS. Windows-to-Mac remains blocked because the documented `agent-macbook`
alias does not resolve from the rollout host.

The prior bounded retry did not remove the underlying ownership defect: the
standalone CLI still instantiated `EnvironmentAuth` and issued/revoked bearer
sessions against its own `state.sqlite`. That was a competing writer beside
the running app server, even when retries avoided an observed lock.

### Next bounded implementation (owned and focused)

The CLI now uses the running server's app-owned auth surface:

1. `POST /api/auth/local-session` is loopback-only and calls the server's
   existing `EnvironmentAuth.issueSession` service.
2. The CLI uses the returned short-lived bearer token for the existing
   authenticated snapshot and dispatch calls.
3. `POST /api/auth/local-session/revoke` is loopback-only and calls the
   server's existing `EnvironmentAuth.revokeSession` service.
4. The CLI no longer provides `EnvironmentAuth`, opens auth persistence, or
   retries local SQLite writes. The server remains the sole auth persistence
   owner.

Focused coverage verifies the sideband target behavior, Windows/Mac shell
transport quoting, and loopback request guard. This implementation has not
been deployed or claimed as cross-host proof; a fresh artifact rollout and
live local-server auth-path verification are the next bounded checks before
any further host proof.

### VPS packaging fact — 13 August 2026

Read-only canary inspection confirmed that the VPS listener on port 3773 is
the packaged `T3 Code (Alpha)` application, launched from its Windows release
directory, not the global npm `t3` bundle. The latter remains useful for CLI
help/transport checks but cannot update the running app server. A staged
server bundle was checksum-verified then removed without replacement. The next
deployment must build and roll the actual Windows desktop artifact with its
prior packaged app retained for rollback; do not patch the unused npm bundle
and claim a runtime update.

### Native Windows canary build result — 13 August 2026

A separate VPS checkout of `c904b2a5e` was created, read the live repository
instructions, and began a Corepack-pinned `pnpm install --frozen-lockfile`.
The live packaged T3 app was never stopped or altered. After the bounded build
window, the installer dependency phase remained active and reduced VPS free
space to about 9 GB, so it was stopped. The exact temporary checkout was then
removed and free space returned to about 9.35 GB.

Conclusion: native Windows packaging is the correct runtime target, but a
fresh full workspace install on the VPS is not the fast reusable deployment
path. The next release-tranche must provision a measured reusable Windows
build cache/runner (or obtain the equivalent private CI artifact) before
retrying; it must build the packaged app, retain the prior app for rollback,
and only then restart one canary host.

## Delegated Windows laptop build and VPS deployment runbook — 14 August 2026

### Outcome

Produce one verified Windows NSIS desktop installer for fork revision
`890f3f7c9942867ec97203789647706613a8c030` on the Windows laptop, then use
that artifact—not a VPS source build—to perform one short, rollback-safe VPS
package replacement and prove native T3 sideband dispatch in both directions.

This is the bootstrap release. After it succeeds, the Windows laptop D: build
workspace becomes the reusable artifact builder and the VPS remains a deploy
host only.

### Ownership and boundaries

| Lane | Owner | May do | Must not do |
| --- | --- | --- | --- |
| Windows artifact build | Visible Windows-laptop T3 build agent | Repair its local build layout, install dependencies, build/checksum NSIS artifact, return a receipt | Install on VPS, alter VPS runtime/user data, use VoiceTools for coordination |
| Release coordination | Portfolio Overseer | Supply current handoff, inspect completion, choose cutover sequence, collect receipts | Take implementation/build ownership |
| VPS package cutover | VPS owning-host deployment agent, after artifact acceptance | Preserve prior package, install one verified artifact, restart once, verify local listener/auth path, roll back if needed | Build the full desktop artifact on VPS, alter T3 SQLite manually, delete rollback before proof |

Create the build owner through the laptop's existing local visible T3 surface
for this one bootstrap tranche. Its model default is `gpt-5.6-luna` with high
reasoning. Once an updated T3 package is installed, ordinary inter-agent
coordination uses native T3 sideband dispatch; SSH is transport only and
VoiceTools is not a coordination fallback.

### Current machine facts

- VPS: existing packaged `T3 Code (Alpha)` owns `127.0.0.1:3773`; it was not
  stopped or replaced during build attempts. After the 14 August cleanup it
  had about 13.67 GiB free. Do not consume its remaining space with a new
  full dependency or desktop build.
- Windows laptop: `D:\\T3Build` is the intended durable build root and has
  approximately 884 GiB free. Its portable Node toolchain is
  `D:\\T3Build\\toolchain\\node-v24.18.0-win-x64\\node.exe` (`v24.18.0`).
- The clean source checkout is
  `D:\\T3Build\\t3-sideband-build-20260814`, checked out at the exact fork
  revision above. It is a disposable source checkout, not a live runtime.
- A first laptop filtered install failed before dependency materialization:
  pnpm reported `EISDIR` while registering its project symlink below
  `D:\\T3Build\\pnpm-store`. The build owner must choose and validate a
  Windows-compatible local store/virtual-store layout before retrying. Do not
  paper over this by changing the lockfile, fetching the relay-only private
  dependency, or moving the full build to VPS.
- `infra/relay` depends on the inaccessible private Alchemy package. The
  desktop installer does not need that workspace. Use the existing filtered
  install boundary excluding `t3code-relay`; do not modify relay source as a
  desktop-build workaround.

### Build-agent procedure

1. Read this plan and the live repository `AGENTS.md`.
2. Inspect the failed pnpm project/store relationship and establish a
   D:-hosted layout that supports pnpm workspace project registration. Record
   the exact chosen store and virtual-store paths in the receipt. Keep source,
   package store, staging, and artifacts on D: where practical.
3. Run the filtered frozen-lockfile install that excludes `t3code-relay`.
   Do not run a full relay-inclusive install merely to satisfy an unused
   private dependency.
4. Verify workspace links are present and run only the desktop packaging
   command:

   ```text
   node scripts/build-desktop-artifact.ts --platform win --target nsis --arch x64
   ```

5. Locate the produced NSIS installer, record its SHA-256, size, source
   revision, and the packaging log outcome. Retain the installer on laptop D:
   under the artifact directory; do not clean the reusable dependency store
   after success.
6. Send the receipt to Portfolio Overseer through native T3 dispatch when
   available; until then, return it through the local visible T3 completion.

### Artifact acceptance and VPS cutover

The overseer accepts an artifact only when the source revision, installer
path, SHA-256, and successful package result are explicit. Then the VPS
owner:

1. Copies the installer to a dated VPS release-staging path and independently
   verifies the SHA-256.
2. Records the current packaged-app path and launch command as rollback
   evidence. Do not delete or overwrite rollback material before post-install
   proof.
3. Performs one controlled installer replacement/restart through the VPS
   owning host. This is the only expected coordination interruption.
4. Verifies the replacement process owns port 3773 and the local
   `/api/auth/local-session` route responds through the running app server.
5. If listener/auth verification fails, restores the recorded prior package
   immediately and reports the rollback receipt. Do not improvise direct
   `app.asar`, npm-bundle, or SQLite patches.

### Acceptance proof and artifact retention

- One exact-title T3 sideband dispatch succeeds Mac -> VPS.
- One exact-title T3 sideband dispatch succeeds VPS -> Mac.
- Each result includes normal dispatch receipt and transcript acceptance
  evidence. Do not retry an ambiguous send without inspecting evidence.
- The verified installer and prior VPS package remain available until both
  receipts are complete. Then retain the reusable D: dependency store and one
  known-good installer; prune only dated temporary source/stage directories
  after free-space measurement.

### Required build receipt

```text
source revision:
build host and D: paths:
Node / pnpm versions:
filtered install command and exit result:
store/virtual-store layout and why it is Windows-compatible:
desktop packaging command and exit result:
installer path, size, SHA-256:
warnings/limitations:
files intentionally retained for the next release:
```
