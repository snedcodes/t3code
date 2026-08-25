# T3 Native Agent Messaging: Behaviour Guide and Working Method

Date: 22 August 2026

Updated 24 August 2026: the same native orchestration path is now proven for
visible worker creation (`thread.create` followed by `thread.turn.start`).

This document records the behaviours that have helped or hindered fluent
agent-to-agent messaging, the failed approaches seen in recent sessions, and
the smallest native T3 method currently proven to work.

It complements the [T3 lifecycle and messaging runbook](t3-portfolio-control-t3-lifecycle-and-messaging-runbook-2026-08-22.md).
It is deliberately an operational guide, not another architecture plan.

## Current conclusion

Native T3 messaging works end-to-end on Alpha. It does not require VoiceTools,
the VoiceTools bridge, `/api/codex`, a new thread, a T3 restart, or a database
change.

The capability is available through the existing shell execution path:

```text
functions.exec → tools.exec_command → T3 CLI auth →
GET /api/orchestration/snapshot →
POST /api/orchestration/dispatch
```

`thread.turn.start` is the command payload sent to the dispatch endpoint. It
is not necessarily a separate model tool exposed in every agent session.

## Proven two-agent test

The tested route was:

```text
Advance Multi-Cell Execution Control 21 Aug
    → Execution Control Assistant 21 Aug
```

Environment: MacBook Pro (2), T3 Alpha, port `3773`.

The source agent received an instruction through native T3. It then used its
own `functions.exec` path to message the target. The target received:

```text
NATIVE_EXEC_DISPATCH_TEST from Advance Multi-Cell Execution Control 21 Aug.
Reply with exactly NATIVE_EXEC_DISPATCH_ACK.
```

The target replied exactly:

```text
NATIVE_EXEC_DISPATCH_ACK
```

Source-to-target receipt:

- environment ID: `4589bff7-63f7-431b-a92f-4d291f914de3`
- project ID: `e794e2d8-bff1-4cd1-805c-669b289be4db`
- target thread ID: `981386ed-88c9-47c0-822e-6441b5d3ec8d`
- dispatch sequence: `853623`
- command ID: `b8607d4b-95e2-4450-87cd-2da83bec1431`
- message ID: `e8ebf2c8-4374-4793-a260-fdf2b27f4a35`
- target reply: `NATIVE_EXEC_DISPATCH_ACK`
- auth session: revoked after the test

The outer coordinator-to-source instruction was also delivered natively,
with dispatch sequence `853567`.

## The smallest working method

For a normal coordination window:

1. Use the existing `functions.exec` tool and `tools.exec_command`.
2. Issue one short-lived T3 API session against the intended environment:

   ```bash
   t3 auth session issue \
     --base-dir /Users/snedmusic/.t3 \
     --ttl 2m \
     --json
   ```

3. Use the returned bearer token to read the live snapshot:

   ```text
   GET http://127.0.0.1:3773/api/orchestration/snapshot
   ```

4. Resolve the exact project and target thread from that snapshot. Title
   matching is only for lookup. Dispatch must use the raw UUID returned by
   T3; do not add a `t3-thread:` prefix.
5. Send one native command:

   ```text
   POST http://127.0.0.1:3773/api/orchestration/dispatch
   ```

   with a payload equivalent to:

   ```json
   {
     "type": "thread.turn.start",
     "commandId": "<new-command-uuid>",
     "threadId": "<exact-target-thread-uuid>",
     "message": {
       "messageId": "<new-message-uuid>",
       "role": "user",
       "text": "<message to deliver>",
       "attachments": []
     },
     "runtimeMode": "full-access",
     "interactionMode": "default",
     "createdAt": "<current-iso-timestamp>"
   }
   ```

6. Record the dispatch sequence, command ID, message ID, and HTTP result.
7. When confirmation is required, read the target detail endpoint:

   ```text
   GET http://127.0.0.1:3773/api/orchestration/threads/<raw-thread-uuid>
   ```

8. Reuse the same bearer token for additional messages during that active
   coordination window. Refresh it only when it expires. Revocation after
   every message is not required.

For another computer, use that environment's supported authenticated T3
connection. A shell running on the owning host can issue the short-lived
session against that host's matching T3 home. A normal T3 client can instead
use its already-authenticated saved-environment connection runtime. Do not
assume a Mac-local `--base-dir` can mint credentials for a remote host.

## Native visible-worker creation

For an explicitly requested new visible worker:

1. Read the live snapshot and resolve the exact destination project.
2. Check for an existing active thread with the exact requested title.
3. Generate one raw thread UUID and send one native `thread.create`.
4. Send the initial instructions to that thread with one native
   `thread.turn.start`.
5. Read back the thread detail and confirm title, project, first message, and
   session state.
6. If creation is uncertain, re-read the snapshot before retrying.

This was proven on 24 August by creating the visible `T3 Build Coordinator`
thread. Do not use the VoiceTools creation wrapper, a hidden sub-agent, T3
Chat, browser automation, or direct database mutation as a substitute.

## Behaviour that hurts or hinders messaging

### 1. Looking for a special model tool

The failed agent searched for a separately exposed tool named
`thread.turn.start`. That was the wrong abstraction. `thread.turn.start` is a
native T3 command type; the agent already had the ability to run the required
client code through `functions.exec`.

This produced a false “native dispatch unavailable” result even though the
server and the shell path were available.

### 2. Treating tool-surface absence as product-capability absence

The fact that a session did not list a dedicated dispatch tool did not prove
that T3 could not dispatch. It only proved that the tool was not exposed as a
first-class model tool in that session.

The correct next step was to inspect the existing T3 source and CLI, then use
the available shell tool.

### 3. Using the wrong authentication endpoint

The agent tried:

```text
POST /api/auth/local-session
```

Alpha returned `404`. That was an unsupported path, not evidence that native
messaging was unavailable.

The working authentication path is the T3 CLI command:

```text
t3 auth session issue --base-dir /Users/snedmusic/.t3 --ttl 2m --json
```

The returned bearer token is then used with the orchestration HTTP endpoints.

### 4. Inventing an execution path instead of using the existing one

The agent introduced a temporary TypeScript-file approach after a local stdin
parsing error. That was unnecessary ceremony for a short authenticated API
call. It increased moving parts and delayed the actual dispatch.

The minimal path is a shell command using the existing T3 CLI and endpoint.

### 5. Repeating prohibitions and status announcements

The agent repeatedly announced that it would not use VoiceTools, legacy routes,
fallbacks, or guessed IDs. Those constraints were useful once in the command
brief, but repeating them before every step added noise without improving
delivery.

The useful output is the final receipt and, when requested, the target
readback.

### 6. Adding a preflight ceremony to a simple test

The agent turned a one-message test into multiple narrated stages: capability
discovery, path validation, temporary execution setup, auth diagnosis, route
investigation, and repeated “one eventual dispatch” promises.

Exact target resolution and one dispatch are appropriate. Repeated ceremony
around them is not.

### 7. Revoking the API credential after every message

The temporary API credential is not the agent's T3 thread session. Revoking it
does not stop the worker, close the thread, or affect the agent's ongoing work.

For regular messaging, create one credential for the active coordination
window and reuse it. Revoke it when coordination ends or let it expire. Per-
message issue/revoke cycles make frequent messaging slower and more fragile.

### 8. Confusing lookup names with dispatch IDs

Titles are human lookup labels. Dispatch requires the exact raw UUID returned
by the live snapshot. Adding prefixes, inventing IDs, or dispatching by title
creates avoidable failures.

### 9. Mixing native T3 and VoiceTools routes

During the VoiceTools retirement, agents must not silently switch between
native T3, VoiceTools, `/api/codex`, and legacy bridge routes. A failed native
attempt must be reported honestly, but it must first use the actual native CLI
and orchestration endpoint.

VoiceTools remains a temporary compatibility system only. It is not required
for the proven native message path.

### 10. Restarting systems to solve a messaging problem

Messaging tests do not require restarting T3, changing ports, restarting
VoiceTools, rebuilding the GUI, or modifying the database. Those actions can
interrupt unrelated workers and destroy the continuity the messaging system
is meant to provide.

The only environment checks needed are that the intended T3 descriptor and
profile are reachable and that the target thread exists.

### 11. Over-validating after a successful receipt

Once the dispatch is accepted and the target reply is present, further proofs,
architecture reviews, and repeated retries do not improve the message. Stop
and report the receipt.

## Behaviour that helps fluent messaging

- Start with the user's requested action and use the available shell path.
- Inspect the T3 source/CLI when a capability appears absent instead of
  concluding that the product cannot do it.
- Use one clear native route: CLI auth, live snapshot, exact UUID, dispatch,
  optional target detail readback.
- Resolve exact environment, project, and thread identity before dispatch.
- Use raw UUIDs from the live snapshot.
- Send exactly one message when the instruction says one.
- Reuse one auth credential during a short coordination window.
- Retry authentication once if the session store reports a transient lock;
  never repeat a dispatch unless the first dispatch was definitively not sent.
- Distinguish “dispatch accepted” from “target replied.”
- Report only the receipt fields needed to continue: target, sequence, command
  ID, message ID, delivery state, and target readback.
- Do not restart or alter unrelated runtime state.
- If the target is busy, wait for its existing turn to settle rather than
  sending duplicates.
- Keep VoiceTools explicitly out of native tests while the migration proceeds.

## Reusable prompt for an agent

```text
Use your existing functions.exec tool. Do not search for a separate model tool
named thread.turn.start.

Use native T3 only:

1. Issue one short-lived session with:
   t3 auth session issue --base-dir /Users/snedmusic/.t3 --ttl 2m --json
2. Read the live snapshot from:
   http://127.0.0.1:3773/api/orchestration/snapshot
3. Resolve the exact project and target thread and use their raw UUIDs.
4. Send one thread.turn.start command to:
   POST http://127.0.0.1:3773/api/orchestration/dispatch
5. Read the target thread detail if a reply confirmation is required.
6. Reuse the same bearer token for further messages in this coordination
   window; do not revoke it after every message.

Do not use VoiceTools, the VoiceTools bridge, /api/codex,
/api/auth/local-session, guessed IDs, title-only dispatch, or a new thread.
Do not restart T3 or modify the database.

Report the dispatch sequence, command ID, message ID, delivery state, and
target readback. If authentication reports a transient database lock, retry
authentication once only; do not duplicate a dispatch.
```

## Ports and profiles

The messaging method is independent of whether the local Mac environment is
Alpha on `3773` or Dev on `3774`. The agent must use the actually reachable
server and its matching profile. A port change alone does not change the
database, but two T3 owners must not run against the same live profile at the
same time.

For current Mac usage:

- Alpha: `http://127.0.0.1:3773`, normally `/Users/snedmusic/.t3`;
- source Dev: `http://127.0.0.1:3774`, only when its selected profile is the
  active owner.

Verify the intended descriptor before dispatch. Do not restart either build
just to make messaging work.

## Current boundary

The native capability is proven, but it is not yet exposed as a universal
first-class agent tool in every session. Until that product surface is built,
agents need shell access and the reusable prompt above. This is an interface
and guidance limitation, not a limitation of T3's orchestration endpoint.

The current native procedure already works and should be used directly. A
small first-class command may later package the same authenticated
snapshot/dispatch/readback procedure to reduce repetition, but it is not a
messaging prerequisite. Historical `sideband-send` work may be consulted as
reference; do not delay current sends to recover it or restore its old auth
endpoint. Any eventual helper must avoid another broker, registry, polling
loop, competing SQLite writer, or VoiceTools dependency.
