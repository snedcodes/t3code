# T3 Lifecycle, Ports, Profiles, and Messaging Runbook

Date: 22 August 2026

This document preserves the operational recap and Alpha clarification supplied
for T3 Code, including the exact wording intended for reuse with other agents.

## Recap and operating model

Here is the current operating model.

## The central rule

A T3 environment is defined by:

1. its running server;
2. its port;
3. its T3 home/profile directory;
4. its local database.

The port is only the address. The database and projects come from the `--home-dir`.

Changing from `3773` to `3774` does not lose messages if the same profile is used. Changing from `/Users/snedmusic/.t3` to another home directory creates a different environment with different projects, threads, preferences, and provider sessions.

## Current Mac state

I checked the machine read-only:

- T3 Dev is currently listening on `3774`.
- Its web client is on `5841`.
- Current process PID: `25073`.
- Port `3773` is currently unused.
- The T3 environment descriptor responds correctly on `3774`.
- VoiceTools is running on `8507`, but its current readiness report is stale/degraded and says its last T3 probe was refused.

The older documents contain historical references to Mac Dev on `3773`; the live runtime state is the authoritative source now. Current Dev should be treated as `3774`.

## Alpha and Dev

The reason Alpha and Dev caused trouble is that a different port does not make it safe to run two T3 owners against the same profile.

If both instances use:

```text
/Users/snedmusic/.t3
```

they must not run simultaneously, even if one uses `3773` and the other uses `3774`.

Recommended arrangement:

- Alpha: `3773` with its Alpha profile.
- Dev: `3774` with the explicitly selected Dev profile.
- If Dev is intentionally using your real existing profile, shut Alpha down before starting Dev.

## Safe Dev restart procedure

Before restarting:

1. Let active agent turns finish where possible.
2. Do not start another T3 instance against the same profile.
3. Close the Electron Dev window normally, or press `Ctrl-C` in the terminal that owns the Dev launcher.

If the process is genuinely stuck, read the PID from:

```text
/Users/snedmusic/.t3/userdata/server-runtime.json
```

Confirm that PID owns `3774`, then terminate only that exact PID:

```bash
kill -TERM <PID_FROM_SERVER_RUNTIME_JSON>
```

Do not use `pkill`, `kill` with copied shell decoration, or process-name matching.

The current source-first Electron launch command is:

```bash
cd /Users/snedmusic/snedcodes/t3-snedcodes-dev
export PATH="/Users/snedmusic/tools/node24/bin:$PATH"
export T3CODE_PRESERVE_PROVIDER_SESSIONS_ON_SHUTDOWN=1
./node_modules/.bin/vp run dev:desktop \
  --home-dir /Users/snedmusic/.t3 \
  --port 3774
```

After launching, verify the server before using messaging:

```bash
curl -fsS --max-time 5 \
  'http://127.0.0.1:3774/.well-known/t3/environment'
```

That should return the environment descriptor.

## What survives a restart

A normal restart preserves:

- projects;
- threads;
- messages;
- preferences;
- environment registrations;
- the T3 database;
- most resumable provider-session bindings.

The setting `T3CODE_PRESERVE_PROVIDER_SESSIONS_ON_SHUTDOWN=1` improves recovery after ordinary Dev rebuilds. It does not guarantee that an agent turn already executing will continue uninterrupted through a hard kill. Such a turn may need to be resumed manually.

The same environment/project/thread remains available afterward. A hard restart may interrupt the current turn, but it should not erase the conversation.

## Messaging layers

There are currently two paths:

### Native T3

This is the intended long-term path.

A message targets:

```text
environment → project → thread
```

It becomes a normal native `thread.turn.start` operation and is stored in that environment’s T3 database. This is the reliable path for cross-computer agent messaging.

T3 remote connections point to the other computer’s environment; Git does not copy T3 messages or databases between machines.

### VoiceTools

VoiceTools is currently a compatibility and coordination layer. It still provides:

- visible agent discovery;
- title/project resolution;
- session readback;
- phone alerts;
- legacy coordination;
- a bridge for sending commands when required.

It does not own the T3 thread history. Its local bridge must know which T3 port is active.

The current bridge configuration is:

```text
VOICETOOLS_T3_BASE_URL=http://127.0.0.1:3774
```

If T3 moves to another port, VoiceTools can report `t3_server_unreachable` even while VoiceTools itself is healthy. In that case:

1. start T3 on the intended port;
2. verify the T3 descriptor responds;
3. confirm `t3_profile.env` points to that port;
4. restart only the VoiceTools owner on `8507` if its readiness remains degraded.

Do not restart T3 merely because VoiceTools has a stale failed probe.

The canonical VoiceTools restart command is:

```bash
sudo /Users/snedmusic/snedcodes/VoiceToolsSuite-runtime/voicetools/scripts/voicetools_service_control_helper.sh restart
```

That should only be used after confirming the T3 target port. It should not modify the T3 database.

## Standard message to give other agents

You can give agents this operational rule:

> Use native T3 messaging as the primary transport. Target the exact environment, project, and thread. Resolve an agent by its exact title and project before sending. Do not resend a message while the previous turn is pending. Do not restart T3 or VoiceTools automatically. If T3 restarts, verify the same environment descriptor and profile first, then re-read the existing thread. VoiceTools is a compatibility bridge only; if it reports `t3_server_unreachable`, check the configured T3 port before taking action.

The main references are the [Portfolio Control execution plan](../t3-portfolio-control-execution-plan-2026-08-19.md), [multi-computer connectivity handoff](handoffs/t3-portfolio-control-multi-computer-connectivity-handoff-2026-08-21.md), [T3 remote access guide](user/remote-access.md), and [remote architecture notes](internals/remote.md).

No processes or files were changed during this recap.

## Alpha clarification

Yes. The installed packaged app is Alpha:

```text
/Users/snedmusic/Applications/T3 Code 0.0.32.app
```

Its display name is `T3 Code (Alpha)`, and its packaged server default is:

```text
3773
```

So the intended split is:

- Alpha: `3773`
- Source Dev: `3774`

The confusion came from the fact that the current source Dev instance is running on `3774`, while older documents and the packaged Alpha app use `3773`.

Important: if Alpha and Dev both use `/Users/snedmusic/.t3`, do not run them at the same time. They would be two T3 owners against the same database, even though the ports differ.

If you close Dev and open Alpha:

- T3 should open on `3773`;
- your existing projects/messages should remain available if Alpha uses the same profile;
- VoiceTools must point to `http://127.0.0.1:3773`, not `3774`;
- saved remote connections pointing at `3774` may need to be updated or re-paired.

Currently VoiceTools is configured for Dev on `3774`, so switching to Alpha without changing that route would explain messaging failures.

## Stopping workers after a T3 crash

The recent `Stop Controls for Stuck Workers` worker established an important
distinction: restarting T3 can leave a worker's provider session projected as
active even when the GUI has disappeared. Sending a user message containing
`STOP` is not a reliable control signal, and changing ports, killing provider
processes, or writing the SQLite database is not the correct recovery path.

The native control hierarchy is:

### Session stop — permanent worker stop

Use the native orchestration command:

```ts
{
  type: "thread.session.stop",
  commandId: crypto.randomUUID(),
  threadId: "<exact-thread-id>",
  createdAt: new Date().toISOString()
}
```

`thread.session.stop` is the session-level stop. It stops the provider session,
clears its active turn identity, and leaves the thread available for later
resume. It is the correct control for a worker that appears stuck after a T3
crash or for a worker that must be fully stopped before being re-prompted.
It does not require an active turn to remain visible in the GUI.

The source already contains the native contract, client-runtime command,
decider, provider reactor, WebSocket dispatch, and focused tests for this
operation:

- `packages/contracts/src/orchestration.ts`
- `packages/client-runtime/src/operations/commands.ts`
- `apps/server/src/orchestration/decider.ts`
- `apps/server/src/orchestration/Layers/ProviderCommandReactor.ts`
- `apps/server/src/ws.ts`

The missing piece is a clear, always-available user-facing control in the T3
GUI, plus truthful pending/completed/recovery readback.

### Turn interrupt — current contextual stop

Use `thread.turn.interrupt` when the selected thread has an active turn and the
operator only wants to interrupt that turn. This is the existing composer
Stop control. It is not equivalent to stopping the whole worker session and
may not be available after a crash has removed the active turn from the GUI.

### Process termination — not a worker-control method

Do not stop a worker by killing Codex, killing a port, changing T3 ports, using
`pkill`, or editing SQLite. Process termination is reserved for a verified T3
server/GUI owner during a deliberate runtime restart, not for controlling an
individual agent thread.

## Manual native stop procedure

When the GUI is unavailable but the T3 server is healthy, use the native
orchestration route with an authenticated short-lived session. The exact
thread ID must come from the live T3 thread/environment catalog; do not infer
it from a title or stale VoiceTools cache.

```bash
BASE_DIR=/Users/snedmusic/.t3
T3_ORIGIN=http://127.0.0.1:3774

AUTH_JSON=$(t3 auth session issue \
  --base-dir "$BASE_DIR" \
  --ttl 2m \
  --label manual-session-stop \
  --json)

TOKEN=$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).token)' "$AUTH_JSON")
SESSION_ID=$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).sessionId)' "$AUTH_JSON")

THREAD_ID="PUT_EXACT_THREAD_ID_HERE"

PAYLOAD=$(node -e '
process.stdout.write(JSON.stringify({
  type: "thread.session.stop",
  commandId: crypto.randomUUID(),
  threadId: process.argv[1],
  createdAt: new Date().toISOString()
}))
' "$THREAD_ID")

curl -fsS -X POST "$T3_ORIGIN/api/orchestration/dispatch" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  --data "$PAYLOAD"

t3 auth session revoke --base-dir "$BASE_DIR" "$SESSION_ID"
```

After dispatch, re-read the native orchestration snapshot and confirm:

```text
session.status = stopped
activeTurnId = null
```

If a fresh active turn immediately appears, that indicates queued-message or
automatic-session-recovery behavior. Do not resend the worker prompt. Re-read
the new active turn and use the native `thread.turn.interrupt` operation once,
then verify that the session is stopped. The permanent GUI control should
perform this readback and surface the recovery state rather than silently
claiming success.

## Permanent T3 GUI stop button

The requested product behavior is a permanent session-stop button in the T3
Dev app:

```text
Model | Reasoning | Access | Auto Resend | Total Context | Permanent Stop | Send / Stop
```

The Total Context counter moves one position to the left. The new Permanent
Stop control sits beside the existing contextual Send / Stop control.

The controls remain deliberately different:

- **Permanent Stop:** dispatches `thread.session.stop` for the selected exact
  thread, whether or not an active turn is currently visible.
- **Send / Stop:** sends a new message when idle or dispatches
  `thread.turn.interrupt` for the active turn.

Required behavior:

- no selected thread: Permanent Stop disabled;
- ready/stopped session: disabled;
- starting/running session: enabled;
- stop request pending: disabled with a spinner and duplicate-click guard;
- accepted stop: re-read the native session state and show `stopped`;
- failure: re-enable the button and show the actual error;
- automatic recovery: detect a new active turn and offer/perform the explicit
  interrupt follow-up, with a receipt visible to the operator.

The first implementation should reuse the existing native client command and
server path. It should not add a VoiceTools route, a second stop protocol, a
process killer, a port switch, or a direct database operation. A later
Portfolio/Rotations list-level button can call the same exact-thread command
for workers that are not currently open in the chat view.

## Separate unresolved Dev crash track: edited-file diffs

The worker also investigated the crash that occurs when opening an edited file
from a diff. This is separate from worker stopping and should not be mixed into
the stop-button change.

Current evidence points to an Electron/Chromium GPU-helper failure rather than
a normal React exception:

- two T3 Dev crash reports fault on Chromium's `CrGpuMain` thread;
- both report `EXC_BREAKPOINT/SIGTRAP` in Electron Framework/V8 font or buffer
  handling;
- the suspected trigger path is `DiffPanel.tsx` → `diffFileActions.ts` → the
  Pierre diff/file renderer → `DiffWorkerPoolProvider.tsx`;
- `DesktopWindow.ts` handles renderer-process loss, but does not yet provide
  equivalent application-level diagnosis for a GPU-process death.

The focused diff tests were not evidence of a diff failure because the test
runner stopped before test collection. `apps/web/vite.config.ts` imports
`@t3tools/shared/devProxy`, whose package export currently resolves to raw
`packages/shared/src/devProxy.ts`; the Node-side test loader cannot execute that
`.ts` file. This is a test/configuration loading problem and must be repaired
or bypassed before diff regression tests can provide evidence.

The diff track should first remain diagnostic: add crash/process evidence and a
safe reproduction boundary, then decide on a renderer fallback, GPU fallback,
or Electron upgrade. It must not restart the live Dev app or alter the shared
profile as part of diagnosis.

## Consolidated delegation map

Use separate workers with non-overlapping ownership:

1. **Stop Controls worker — implementation slice**
   Own the T3 GUI Permanent Stop control, pending state, exact-thread target,
   native `thread.session.stop` dispatch, post-stop readback, and focused UI
   tests. Reuse the existing server/client contracts. Do not touch Heartbeat,
   VoiceTools transport, T3 profiles, runtime restarts, or the diff renderer.

2. **Diff Reliability worker — diagnosis slice**
   Own the edited-file crash investigation, GPU/helper evidence, the
   `devProxy.ts` test-loader repair or narrowly scoped test harness fix, and a
   focused reproduction/regression proof. Do not implement the stop button or
   restart the live Dev instance.

3. **Portfolio coordinator**
   Integrate the two receipts, preserve the current dirty worktree, and only
   then decide whether the Portfolio/Rotations list-level stop control should
   reuse the same native command.

4. **Rotations worker and Tasks worker**
   Continue their existing bounded scopes. They must not modify the stop
   control, diff crash path, T3 lifecycle, or VoiceTools transport.

The current worker receipt is: 27 authoritative live messages, sequence
coverage `1–27`, source `t3_projection`, fresh/continuous, thread status
`waiting_for_input`, latest turn completed, and no repair required. Its main
limitations are that transcript context is not filesystem proof and the
proposed UI has not yet been implemented.

## How to continue this work

This conversation has accumulated enough context that it should now be treated
as the consolidation record, not the primary implementation workspace. The
runbook and execution plan are the durable handoff.

The clean next step is a new focused implementation conversation that links
this runbook and names exactly one owner:

- first conversation: implement and focus-test the Permanent Stop control;
- second conversation: diagnose and repair the edited-file diff crash/test
  harness;
- coordinator conversation: integrate receipts and update the execution plan.

Do not ask either implementation worker to restart T3, reload the GUI, change
profiles, alter ports, or send live worker messages as part of its source task.
Runtime changes require a separate explicit operator decision after the source
work is complete.
