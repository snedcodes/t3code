# Native T3 Messaging — Agents Dev Guidelines update handoff

Date: 24 August 2026  
Source project: `T3 Code Reliability`  
Source repository: `/Users/snedmusic/snedcodes/t3-snedcodes-dev`  
Intended recipient: `Agents Dev Guidelines Coordinator 17 Aug`  
Status: `ready_with_caveats`  
Scope: central guidance reconciliation for native T3 messaging and visible T3
worker creation; this handoff does not authorize T3 runtime changes, VoiceTools
deletion, target-repository propagation, or unrelated standards work

## 1. Requested outcome

Update the Agents Dev Guidelines repository so its current guidance describes
one ordinary coordination path:

```text
exact T3 environment
  -> exact project
  -> exact existing thread
  -> native T3 thread.turn.start
  -> dispatch receipt
  -> target-thread readback when confirmation is required
```

VoiceTools must no longer be described as the authority, required broker,
fallback, or creation wrapper for ordinary agent-to-agent messaging or visible
T3 worker creation.

VoiceTools remains recoverable while useful non-messaging capabilities are
preserved and later ported into T3:

- TTS;
- realtime voice-assistant functions;
- relevant audio and voice configuration;
- phone-alert functions that do not broker agent messages; and
- selected legacy Heartbeat, Task, Wishlist, and Portfolio records required for
  one-time import.

The migration is by function. Retire VoiceTools messaging first; do not delete
the VoiceTools repository or retained voice/runtime functionality in this
guidance tranche.

## 2. User decision

The user wants robust inter-agent messaging across the MacBook, Windows laptop,
Windows VPS, and phone using T3 as the system of record and execution
foundation. The current decisions are:

1. Native T3 is the sole ordinary message route.
2. VoiceTools is not an ordinary message fallback.
3. Native T3 creates visible workers as well as messaging existing workers.
4. A sideband command is optional convenience around the same native route; it
   is not a prerequisite or separate architecture.
5. Each computer remains an independent T3 environment that owns its local
   projects, threads, provider sessions, turns, and receipts.
6. Cross-host messages use the same native command contract; only the selected
   environment connection differs.
7. T3, GitHub, and Tailscale/OpenSSH remain separate layers: T3 dispatches
   agent work, GitHub synchronizes source, and Tailscale/OpenSSH administers
   machines.

## 3. Central contradiction to resolve

The current Agents Dev Guidelines repository contradicts itself.

### Root `AGENTS.md`

Current language under `T3 Code Environment` and `VoiceTools Cross-Agent
Coordination` says:

- use VoiceTools-owned Passport, transcript, dispatch, and visible-T3 creation
  surfaces;
- VoiceTools is the coordination authority for discovery, transcript readback,
  dispatch, and visible creation;
- ordinary coordination should use the VoiceTools
  `send_t3_message.py` sender; and
- visible workers should be created through the VoiceTools-owned creation
  wrapper.

Relevant current locations observed on 24 August:

```text
/Users/snedmusic/snedcodes/agents-dev-guidelines/AGENTS.md:63-72
/Users/snedmusic/snedcodes/agents-dev-guidelines/AGENTS.md:85-106
/Users/snedmusic/snedcodes/agents-dev-guidelines/AGENTS.md:117-128
```

### `CURRENT.md`

The current registry passage still says VoiceTools is the live authority for
session identity, route health, transcript freshness, and visible T3 creation:

```text
/Users/snedmusic/snedcodes/agents-dev-guidelines/CURRENT.md:192-193
```

It also lists older VoiceTools routing standards and techniques without a clear
superseded-for-ordinary-messaging label.

### Native T3 sideband standard

The current native standard says the opposite:

```text
/Users/snedmusic/snedcodes/agents-dev-guidelines/standards/
2026-08-13_native_t3_sideband_agent_coordination.md
```

It says ordinary T3 coordination must not depend on VoiceTools and that
VoiceTools is optional for retained phone, TTS, realtime-assistant, and
Portfolio functions. However, it still frames the `sideband-send` commands as
an incomplete deployment gate. Native dispatch now works without recovering
that historical command, so this standard also needs reconciliation.

These three current authorities must be updated as one coherent tranche. Do
not patch only one and leave another current contradiction.

### Existing central working-tree caution

Read-only `git status --short` on 24 August showed that the Agents Dev
Guidelines repository was already dirty before this handoff was created:

```text
 M AGENTS.md
?? DOCS/AGENTS_BACKUP/AGENTS_BACKUP_2026-08-15_session_rename_boundary.md
?? DOCS/COMMUNICATION_DRAFTS/
?? DOCS/SESSION_RECOVERY/2026-08-14_PORTFOLIO_OVERSEER_ACTIVE_AGENT_AND_PROJECT_HANDOFF.md
?? DOCS/SESSION_RECOVERY/2026-08-14_T3_MAC_RUNTIME_INTERRUPTION_COMPLAINT_HANDOFF.md
?? DOCS/SESSION_RECOVERY/2026-08-15_WINDOWS_T3_OFFICIAL_BASELINE_AND_SAFE_FUTURE_RELEASE_DRAFT.md
?? DOCS/Theo Agents md Breakdown.md
?? DOCS/sudo.md
?? agent_roles/handoffs/portfolio-overseer/2026-08-13_named_session_intake_portfolio_synthesis.md
?? agent_roles/receipts/2026-08-13_volgrid_research_agent_3_coordinator_handoff_receipt.md
?? index-Dsrh3Aqx.js
```

These changes belong to other work unless the central coordinator proves
otherwise. Before editing, inspect the existing `AGENTS.md` diff and relevant
untracked documents, identify overlap, and preserve or integrate them. Do not
reset, clean, overwrite, or silently absorb unrelated changes. This handoff
did not modify any file in the Agents Dev Guidelines repository.

## 4. Proven native message procedure

The currently proven shell/API path is:

```text
functions.exec
  -> tools.exec_command
  -> T3 CLI short-lived auth session
  -> GET /api/orchestration/snapshot
  -> resolve exact raw project/thread UUIDs
  -> POST /api/orchestration/dispatch
       type: thread.turn.start
  -> GET /api/orchestration/threads/<raw-thread-uuid> when readback is needed
```

`thread.turn.start` is a T3 orchestration command type. It does not need to
appear as a separately exposed model tool. An agent with the normal shell tool
can invoke the existing T3 CLI and authenticated orchestration API.

### Host-local Alpha evidence

The following values are dated Mac evidence, not universal policy:

```text
T3 home:       /Users/snedmusic/.t3
origin:        http://127.0.0.1:3773
environmentId: 4589bff7-63f7-431b-a92f-4d291f914de3
```

The working authentication command was:

```bash
t3 auth session issue \
  --base-dir /Users/snedmusic/.t3 \
  --ttl 2m \
  --json
```

The bearer token was used with:

```text
GET  http://127.0.0.1:3773/api/orchestration/snapshot
POST http://127.0.0.1:3773/api/orchestration/dispatch
GET  http://127.0.0.1:3773/api/orchestration/threads/<raw-thread-uuid>
```

For another environment, use that environment's supported authenticated T3
connection. A shell running on the owning host may issue the short-lived
session against that host's matching T3 home. A normal T3 client may instead
use the already-authenticated saved-environment connection runtime. SSH is
transport for invoking an owning-host command; it is not a second broker or
identity system.

### Target resolution

Resolve the exact target from the live T3 snapshot:

```text
environmentId + projectId + threadId
```

Human titles may be used to find and disambiguate the target in the live
snapshot. Dispatch uses the raw UUID returned by T3. Do not invent a
`t3-thread:` prefix, use a stale VoiceTools `host_id`, guess a raw ID, or send
by unresolved title alone.

### Message payload

The native message command is equivalent to:

```json
{
  "type": "thread.turn.start",
  "commandId": "<new-command-uuid>",
  "threadId": "<exact-target-thread-uuid>",
  "message": {
    "messageId": "<new-message-uuid>",
    "role": "user",
    "text": "<message>",
    "attachments": []
  },
  "runtimeMode": "full-access",
  "interactionMode": "default",
  "createdAt": "<current-iso-timestamp>"
}
```

The actual runtime and interaction mode should follow the requested operation
and target policy; the values above are the proven ordinary-worker example,
not a mandate to escalate access.

### Receipt semantics

Record:

- exact environment/project/thread target;
- dispatch sequence;
- command ID;
- message ID;
- whether dispatch was accepted; and
- target-thread readback or reply when confirmation is required.

`accepted`, `target received`, `target replied`, and `substantive work
completed` are different states. Do not duplicate an uncertain send before
reading the native target state.

## 5. Proven native visible-worker creation

Visible T3 workers can be created without VoiceTools and without a hidden
sub-agent.

The proven procedure is:

1. Read the live T3 snapshot.
2. Resolve the exact destination project.
3. Check that no active thread already has the requested exact visible title.
4. Send exactly one native `thread.create` command with a caller-generated raw
   thread UUID and the project's selected model/runtime settings.
5. Send exactly one native `thread.turn.start` to the new raw thread UUID with
   its initial instructions.
6. Read the thread detail and confirm title, project, first user message, and
   session state.
7. If creation is uncertain, re-read the live snapshot before retrying. Never
   create a blind duplicate.

### 24 August creation receipt

The visible worker `T3 Build Coordinator` was created natively in project
`T3 Code Reliability` on Mac Alpha:

```text
projectId:             e0f28cd3-9fe9-4cda-8867-00bf25666585
threadId:              665fdd70-dcec-4b18-924c-18a60b095270
thread.create sequence: 886311
thread.create command:  c26f6f16-9b58-4a64-b8a5-dc8917bf3d89
turn.start sequence:    886322
turn.start command:     d1d80c13-5070-47e2-9854-bd9585bbb13c
first message ID:       a160ecce-0c26-4de6-85eb-026181577c66
readback:               exact title/project/message present; session starting
```

No VoiceTools route, VoiceTools creation wrapper, direct database write,
browser workaround, or hidden sub-agent was used.

This is current fork capability evidence. Central wording should describe the
native contract and exact-target/duplicate-prevention invariant without
baking these host-specific IDs into reusable policy.

## 6. Existing successful messaging evidence

The durable T3 messaging behaviour guide records a successful native send:

```text
source: Advance Multi-Cell Execution Control 21 Aug
target: Execution Control Assistant 21 Aug
environment: MacBook Pro (2), Alpha, port 3773
projectId: e794e2d8-bff1-4cd1-805c-669b289be4db
threadId: 981386ed-88c9-47c0-822e-6441b5d3ec8d
dispatch sequence: 853623
commandId: b8607d4b-95e2-4450-87cd-2da83bec1431
messageId: e8ebf2c8-4374-4793-a260-fdf2b27f4a35
reply: NATIVE_EXEC_DISPATCH_ACK
```

Mac-to-Windows native messaging has also been used successfully, and the T3
repository contains earlier VPS native dispatch/readback evidence. Current
runtime or cross-host reachability must still be rechecked before presenting a
dated receipt as current live status.

## 7. Sideband relationship

Historical fork work provides `sideband-send` and `sideband-send-ssh` helper
commands. These package exact-title lookup and native orchestration dispatch.
They may remain useful convenience and SSH invocation patterns.

They are not:

- a separate message transport;
- a required backend;
- a prerequisite for ordinary native sends;
- a reason to restore the removed `/api/auth/local-session` route;
- a VoiceTools replacement broker; or
- a gate before updating central guidance.

Central guidance should be named around **native T3 coordination**, not around
sideband as though sideband were the architecture. If the existing file name
is retained for history, its status and current direct-native procedure must be
explicit at the top.

## 8. Behaviour to remove from current guidance

Remove current instructions that tell agents to:

- use VoiceTools for ordinary T3 messages;
- treat VoiceTools as the authority for native thread identity or transcript
  truth;
- use `/api/codex`, `host_id`, Passport, or legacy session keys as the native
  dispatch route;
- use the VoiceTools visible-agent creation wrapper as the normal creation
  path;
- fall back to VoiceTools after an incorrectly constructed native attempt;
- search only for a dedicated model tool named `thread.turn.start` and declare
  native dispatch unavailable when it is absent;
- call the removed `/api/auth/local-session` endpoint;
- restart T3 or VoiceTools to repair an agent's misunderstanding of the
  command path;
- revoke and recreate an API session for every individual message; or
- resend while the first dispatch remains uncertain.

Preserve the useful exact-title and duplicate-prevention intent, but move title
resolution into the live native T3 snapshot and dispatch by the resulting raw
native identity.

## 9. Proposed compact replacement standard

Adapt this wording into the central `AGENTS.md`:

> Use native T3 for ordinary agent-to-agent messaging and visible worker
> creation. Resolve the exact owning environment, project, and thread from the
> live T3 environment, then send one normal native `thread.turn.start` and
> retain its receipt. Use `thread.create` followed by `thread.turn.start` for
> one explicitly requested new visible worker, after checking the live project
> for an exact-title duplicate. Human titles are lookup labels; native
> dispatch uses the raw identity returned by T3. Do not use VoiceTools, the
> VoiceTools bridge, `/api/codex`, host IDs, guessed IDs, title-only dispatch,
> direct database writes, T3 Chat, or hidden sub-agents as ordinary
> substitutes. A helper such as sideband may package the same native route but
> is optional. If a send or creation result is uncertain, read the native
> target state before retrying.

Add a separate preservation statement:

> VoiceTools remains a temporary retained-feature and migration source for
> TTS, realtime voice-assistant functions, relevant alerts/audio settings, and
> selected legacy Portfolio records. It is not the ordinary T3 message broker,
> native thread authority, or visible-worker creation owner.

## 10. Files to reconcile in the central repository

Minimum coherent tranche:

1. `/Users/snedmusic/snedcodes/agents-dev-guidelines/AGENTS.md`
   - replace the VoiceTools coordination-authority rule;
   - replace the VoiceTools creation-wrapper rule;
   - retain the no-hidden-sub-agent, no-T3-Chat, exact-target,
     duplicate-prevention, receipt, and uncertain-send safeguards.
2. `/Users/snedmusic/snedcodes/agents-dev-guidelines/CURRENT.md`
   - make native T3 the current ordinary coordination authority;
   - classify older VoiceTools routing documents as legacy/migration evidence;
   - point to the updated native T3 standard.
3. `/Users/snedmusic/snedcodes/agents-dev-guidelines/standards/2026-08-13_native_t3_sideband_agent_coordination.md`
   - update the operating path to the proven authenticated
     snapshot/dispatch/readback procedure;
   - make sideband optional convenience;
   - include native visible-worker creation;
   - retain exact-target, single-send, readback, and SSH-as-transport rules.
4. The repository's required changelog, current pointer, trajectory, adoption,
   or propagation evidence documents according to its live `AGENTS.md`.

Do not silently rewrite every historical VoiceTools standard. Preserve dated
history, but mark documents that conflict with the new current standard as
superseded for ordinary messaging.

## 11. Scope and safety boundaries

This central-guidance tranche must not:

- restart, rebuild, reload, quit, or reconfigure any T3 runtime;
- start or stop VoiceTools;
- delete or disable VoiceTools code or services;
- mutate T3 or VoiceTools databases;
- issue live inter-agent messages merely to update documentation;
- create or retire a worker;
- modify the T3 repository's `AGENTS.md` or other target-repository guidance
  unless the user separately authorizes propagation;
- alter credentials, SSH, Tailscale, GitHub access, or environment pairing; or
- present dated runtime receipts as current host health.

The user is separately planning T3-local documentation updates. The central
coordinator should own only the Agents Dev Guidelines repository and return an
adoption/propagation recommendation rather than editing target repositories
automatically.

## 12. Required validation

Use focused documentation validation only:

1. Search current central authority files for statements that still make
   VoiceTools mandatory for ordinary messages or worker creation.
2. Search for contradictory statements about sideband being both mandatory and
   optional.
3. Confirm the updated root guidance, `CURRENT.md`, and native standard all
   name the same ordinary route.
4. Confirm older VoiceTools materials are retained and clearly classified.
5. Run repository-required Markdown/link/drift checks for only the changed
   central files.

Do not turn this into a new architecture plan, live proof ladder, VoiceTools
deployment, T3 build, or broad cross-repository propagation exercise.

## 13. Completion receipt requested

Return:

- branch and HEAD before the tranche;
- files changed;
- the exact new ordinary messaging and visible-creation wording;
- which VoiceTools documents remain current for retained non-messaging
  capabilities;
- which older documents were marked historical for ordinary coordination;
- focused checks run;
- whether any target repository was changed;
- whether any message, worker creation, runtime action, or external service
  mutation occurred; and
- exactly three recommended propagation actions.

Status is:

- `ready_with_caveats` when central authorities agree and remaining target
  propagation is explicit;
- `needs_more_context` when a current central authority cannot be reconciled
  from repository evidence; or
- `blocked` only when the central repository cannot be safely edited without
  user input or a genuinely unavailable dependency.

## 14. Source references

T3 repository:

- `/Users/snedmusic/snedcodes/t3-snedcodes-dev/AGENTS.md`
- `/Users/snedmusic/snedcodes/t3-snedcodes-dev/docs/t3-native-messaging-portfolio-consolidation-plan-2026-08-23.md`
- `/Users/snedmusic/snedcodes/t3-snedcodes-dev/docs/t3-native-agent-messaging-behaviour-guide-2026-08-22.md`
- `/Users/snedmusic/snedcodes/t3-snedcodes-dev/docs/t3-portfolio-control-architecture-decision-2026-08-19.md`
- `/Users/snedmusic/snedcodes/t3-snedcodes-dev/docs/handoffs/t3-build-coordinator-2026-08-24.md`

Central repository:

- `/Users/snedmusic/snedcodes/agents-dev-guidelines/AGENTS.md`
- `/Users/snedmusic/snedcodes/agents-dev-guidelines/CURRENT.md`
- `/Users/snedmusic/snedcodes/agents-dev-guidelines/standards/2026-08-13_native_t3_sideband_agent_coordination.md`
- `/Users/snedmusic/snedcodes/agents-dev-guidelines/standards/2026-06-30_voicetools_session_readback_and_cross_machine_routing.md`
- `/Users/snedmusic/snedcodes/agents-dev-guidelines/TECHNIQUES/2026-06-02_cross_host_voicetools_dispatch_and_completion_readiness.md`
- `/Users/snedmusic/snedcodes/agents-dev-guidelines/standards/2026-08-02_owning_host_visible_t3_creation_and_duplicate_prevention.md`
