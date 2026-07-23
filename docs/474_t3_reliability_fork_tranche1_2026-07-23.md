# Plan 474: T3 Reliability Fork Tranche 1

Date: 23 July 2026  
Owner: T3 Reliability Fork Agent  
Base: `v0.0.29-nightly.20260723.880` (`2d31cb022`)  
Status: Planning checkpoint; isolated runtime launch intentionally not performed

## Scope and safety boundary

This is the T3-local research/proof lane for VoiceTools Plan 473. It does not
modify, stop, replace, or share state with the installed production T3 app.
No installed `app.asar`, production SQLite file, live turn, or process was
changed. No automatic process termination or pending-prompt resend is in scope.

## Evidence baseline

- Fork remote: `https://github.com/snedcodes/t3code.git`
- Upstream remote: `https://github.com/pingdotgg/t3code.git`
- Installed app: `/Applications/T3 Code (Nightly).app`
- Installed version: `0.0.29-nightly.20260709.769`
- Installed Electron bundle ID: `com.t3tools.t3code`
- Installed user data: `~/Library/Application Support/t3code`
- Installed server listener: `127.0.0.1:3773`, owned by the GUI server
- Installed database: `~/.t3/userdata/state.sqlite` with WAL/SHM siblings
- Current upstream tag: `v0.0.29-nightly.20260723.880`
- Current upstream commit: `2d31cb022dee43e5a729273a6936228f30077e29`
- Fresh branch: `sned/t3-reliability-upstream-880`

The installed app already has Electron `requestSingleInstanceLock` and
`second-instance` reveal behavior. The reliability boundary is therefore
server/database/provider ownership, lifecycle terminality, shutdown, and
projection recovery—not a missing desktop lock.

## Installed versus current upstream

Current upstream includes the following relevant merged changes after the
installed tag:

- `501ce27b8`: clear stale active turns when a provider session becomes
  inactive, with regression coverage.
- `783692afc`: preserve connecting state while a turn starts and clear pending
  turn starts for terminal startup states.
- `32c6012da`: server-backed settled-thread lifecycle (primarily Sidebar v2).
- `376c149ea`: provider-session lifecycle and Git/PR status stabilization.
- `f74eb6266`: avoid crash dialogs from EPIPE on desktop child output.

These reduce stale-state and projection risks but do not prove single database
ownership, provider-child ownership, bounded quit, or authoritative recovery
for a message with no native `turn/started` event. Current upstream does have
an authenticated `server.getProcessDiagnostics` RPC backed by
`ProcessDiagnostics`; it reports process rows/descendants and has a guarded
signal path. That is useful existing machinery, but it is not the requested
read-only ownership contract because it does not combine build identity,
listener/database/WAL ownership, provider children grouped by thread,
native/projected turn pairing, and shutdown/reconciliation state. The signal
path must remain out of the first read-only tranche.

The following fetched commits remain research-only and are not ancestors of
`upstream/main`: `3d0f07444` (bounded child shutdown), `1d0fc944a` (forced CLI
exit after graceful shutdown stalls), `54a555c71` (orchestration-v2 controls
and process recovery), `380845ba7` (release turns after interrupt timeout),
and `0ac8024a0` (visible runtime-reconcile cancellation). Review against this
baseline before any selective replay; do not blindly cherry-pick.

## Isolation design and proof gate

The developer proof must use all of these values, passed explicitly and
asserted before launch:

| Resource | Production | Isolated proof |
| --- | --- | --- |
| app name / ID | T3 Code (Nightly) / `com.t3tools.t3code` | `T3 Reliability Dev` / `com.t3tools.t3code.reliability-dev` |
| Electron user data | `~/Library/Application Support/t3code` | `/tmp/t3-reliability-880/user-data` |
| T3 base directory | `~/.t3` | `/tmp/t3-reliability-880/t3-home` via `T3CODE_HOME` |
| server port | `3773` | `3873` (explicit, no auto-selection) |
| database | `~/.t3/userdata/state.sqlite` | `/tmp/t3-reliability-880/t3-home/userdata/state.sqlite` |

The copied/test database must be created before launch, or initialized empty;
it must never be a symlink or path alias to `~/.t3`. The launch gate must
fail closed unless: the production listener is identified as `3773`, the
isolated port is `3873`, the isolated `T3CODE_HOME` and Electron user-data
paths are distinct real paths, and no isolated DB/WAL/SHM path resolves to the
production DB family. The proof must be run with the official app left alone.

The source supports this design: `T3CODE_HOME` controls the server base
directory, server paths derive `userdata/state.sqlite`, and Electron sets its
userData path from the desktop environment. A distinct packaged identity is
still required because the existing single-instance lock is bundle-wide.

## Read-only comparison matrix

| Scenario | Installed 769 | Upstream 880 | Evidence/proof status |
| --- | --- | --- | --- |
| Second launch | Lock rejects second instance; reveals existing window | Same lock/reveal path | Source verified; live behavior not exercised |
| Active-turn interrupt | Native interrupt route exists | Same route plus current reactor/projection fixes | Source verified; no live turn touched |
| Selected session/provider stop | Provider stop/session paths exist | Provider lifecycle handling is newer | Needs isolated fixture |
| Quit with active providers | Desktop/backend shutdown path exists | Dev launcher has bounded direct-child fallback; app path still needs proof | Needs isolated fixture |
| Owned children/listener after quit | Not exposed as one contract | Not exposed as one contract | Diagnostic gap |
| Startup reconciliation | Runtime/projection bootstrap and recovery paths exist | Pending terminal cleanup is improved | Needs fixture with stale rows |
| Delayed/pending turn | No proof of authoritative generation start | Pending-start projection handling is improved | Needs isolated delayed-provider fixture |

## Proposed read-only diagnostics contract

Expose one authenticated local read-only operation, for example
`runtime.diagnostics.read`, with a schema-only contract and no mutations:

```ts
{
  build: { version: string; commit: string | null; packaged: boolean },
  desktop: { pid: number | null; parentPid: number | null; startedAt: string | null },
  server: {
    pid: number | null; parentPid: number | null; port: number | null;
    startedAt: string | null; listener: "owned" | "not-owned" | "unknown"
  },
  database: {
    path: string; owner: { pid: number; startTime: string } | null;
    walPath: string; shmPath: string; ownership: "sole" | "contended" | "unknown"
  },
  providers: Array<{
    threadId: string; provider: string; pid: number | null; parentPid: number | null;
    state: "starting" | "running" | "waiting" | "ready" | "stopped" | "exited" | "unknown"
  }>,
  threads: Array<{
    threadId: string; nativeTurn: { id: string; state: string; ageMs: number } | null;
    projectedTurn: { id: string | null; state: string; ageMs: number } | null;
    generation: "unstarted" | "started" | "completed" | "failed" | "unknown"
  }>,
  lifecycle: {
    shutdown: "running" | "requested" | "draining" | "complete" | "unknown";
    reconciliation: "clean" | "stale" | "pending" | "unknown";
  }
}
```

The contract must identify evidence source and capture time in the eventual
implementation. It must not claim provider completion from projection alone,
must not edit SQLite, and must not terminate processes.

## Recommendation

Upgrade first, then patch: use upstream 880 as the fresh baseline because it
contains relevant merged lifecycle fixes and avoids replaying the May-based
local branch. Add the smallest T3-local diagnostics patch next, followed by
selected interrupt/stop/shutdown changes only after isolated reproduction and
ownership evidence. Do not treat any unmerged candidate as release-ready.

## Remaining blockers

1. A safe isolated packaged/dev launch still needs a mechanical preflight and
   test DB; it was not run while the official app was live.
2. Installed runtime behavior for interrupt, quit, child exit, and delayed
   turns cannot be compared without a harmless isolated fixture.
3. The current code has no complete read-only diagnostics schema or endpoint.
4. Provider-child grouping and database ownership need authoritative runtime
   implementation rather than process-name inference.

## Exactly three ranked next actions

1. Add a preflight-only isolation harness and create an empty `3873` proof
   profile; run it only after all path, port, identity, and DB assertions pass.
2. Add the schema-only read contract and server-side read-only collector,
   including parentage, listener, DB owner, provider/thread grouping, and
   shutdown/reconciliation state; test with synthetic fixtures.
3. Run the bounded isolated lifecycle matrix, then select or reject the
   unmerged shutdown/interrupt candidates based on observed evidence.
