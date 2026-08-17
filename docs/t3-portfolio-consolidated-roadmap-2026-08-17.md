# T3 Portfolio Control: consolidated roadmap

Date: 17 August 2026  
Status: current working plan for the T3 dev worktree

## Purpose

This document brings together the recent T3 Portfolio work, the VoiceTools
Heartbeat and messaging findings, the storage and workflow plans, and the new
agent-rotation idea.

The long-term aim is a dependable T3 Portfolio workspace that can supervise
the user's projects and agents, while preserving the existing VoiceTools
Realtime Assistant for a later T3 integration. The Realtime Assistant already
exists; it is not being rebuilt in this work.

## Core ownership model

Native T3 owns:

- projects and threads;
- provider turns and messages;
- native activity and token telemetry;
- native interruption and execution;
- the normal T3 inbox and agent/session navigation.

VoiceTools temporarily owns:

- the existing Portfolio Task and Wishlist ledger;
- the existing Heartbeat settings and lifecycle records;
- cross-host owner routing and Portfolio receipts;
- phone alerts, optional TTS, and the existing Realtime Assistant.

The first Portfolio/Heartbeat owner is the Mac VoiceTools backend. The later
owner is intended to be the VoiceTools VPS. There must be one owner at a time;
T3 must not create a second Portfolio database, Heartbeat scheduler, or session
registry.

## Achieved in the T3 dev worktree

The recent implementation commits provide the following foundation:

- `f99212577` — selectable Heartbeat targets derived from real native T3
  project/thread shells, with active sessions first;
- `6aac093b0` — native context and rotation health from T3 telemetry;
- `013dd829f` — links each Heartbeat target to its existing native T3 thread;
- `d99b5c54d` — paused Heartbeat draft configuration showing cadence, limits,
  expiry, finish line, allowed actions, stop conditions, and receipt owner;
- `62be463e6` — selectable Help & Workflows catalog with inputs, permitted
  actions, stop conditions, evidence, and source references;
- `339440865` — visible Storage destination describing the planned inventory;
- `0fecdbaea` — VoiceTools-aligned Heartbeat stop conditions;
- `48c593e80` — documentation receipt for the current Heartbeat draft.

The current T3 surface includes:

- top-bar Agents and Portfolio controls;
- normal native project/thread navigation;
- native Agents/session linkage;
- Heartbeats-first Portfolio navigation;
- truthful Host Health and VoiceTools-unavailable labels;
- draft destinations for Projects, Documents, Trajectory, and Rants;
- a paused, read-only native Heartbeat foundation;
- native context/token health when telemetry exists;
- Help & Workflows;
- a Storage placeholder;
- the existing native T3 Stop path; and
- per-thread Auto Resend assessment for genuinely stale text-only turns.

Focused web tests, type checks, formatting, and a web build have passed for the
completed web slices. An isolated disposable web verification was attempted;
the environment could start the stack, but browser DOM automation did not
complete reliably. No shared T3 profile or VoiceTools runtime was changed by
those checks.

There is also a current uncommitted implementation attempt for a native
sideband interrupt command in:

- `apps/server/src/cli/turn.ts`;
- `apps/server/src/bin.ts`.

That work is not counted as complete until it has a focused build/test and a
realistic safe verification. It is intended to reuse the existing live T3
orchestration dispatch contract, not to create another interrupt mechanism.

## What is deliberately not connected yet

These items are visible only as honest placeholders or drafts:

- real VoiceTools Heartbeat records;
- real VoiceTools Tasks and Wishlist records;
- live VoiceTools Host Health;
- Heartbeat persistence or controls in T3;
- Heartbeat scheduling or activation;
- Portfolio storage measurement;
- automatic cleanup or database repair;
- cross-host Portfolio owner transfer;
- full token-rotation alert state;
- complete bounded transcript readback;
- automatic rotation of agents;
- AVTransform vNext workflow screen parity; and
- Realtime Assistant access from T3.

## Heartbeat plan

VoiceTools already contains the Heartbeat system. The work is a faithful port
and delivery-path change, not a new scheduler.

### Existing VoiceTools authority

The source evidence identifies:

- `HeartbeatService` in `voicetools/api/heartbeat_service.py`;
- `runtime/heartbeat_settings.json` for Heartbeat settings;
- `PortfolioLedger` in `voicetools/api/portfolio_task_contract.py`;
- `runtime/portfolio_task_ledger.json` for Tasks and Wishlist;
- Heartbeat status/settings routes;
- owner-routed and federated target routes; and
- the existing direct sender in `server.py` and
  `codex_command_service.py`.

The existing lifecycle includes cadence, run limits, expiry, finish-line
completion, pause/stop, overlap prevention, target resolution, delivery
receipts, and self-stop conditions.

### Required next Heartbeat work

1. Add the VoiceTools owner descriptor and owner epoch.
2. Include Portfolio and Heartbeat revisions/checksums.
3. Make non-owner hosts proxy the owner or report owner-unavailable.
4. Keep all Heartbeats paused during owner transfer and testing.
5. Display real Mac-owned Heartbeat records in T3.
6. Preserve exact native T3 environment/thread identity for each target.
7. Replace only the delivery path with native `thread.turn.start`.
8. Distinguish accepted, dispatched, transcript-confirmed,
   confirmation-delayed, uncertain, and failed receipts.
9. Prove one disabled Heartbeat through one normal native T3 turn.
10. Pause it again and retain the receipt.

The first proof must use one existing non-critical target, a maximum run count,
an expiry, and a clear finish line. No broad activation is planned yet.

## Tasks and Wishlist

The authoritative Task/Wishlist data remains the VoiceTools ledger. T3 should
display it after the owner seam is proven, without copying it into a T3
database.

The T3 view should eventually show:

- status and owner;
- checklist and completion condition;
- receipts and freshness;
- Markdown document links;
- Task-to-Passport binding;
- Task-to-Heartbeat binding;
- reviewable Wishlist-to-Task promotion; and
- clear owner/unavailable labels.

Creating a Task or Wishlist item must not automatically claim an agent or
activate a Heartbeat.

## Messaging and stop-turn recovery

The native Stop path is already present:

```text
T3 Stop button
  -> thread.turn.interrupt
  -> orchestration decider
  -> ProviderCommandReactor
  -> provider adapter interrupt
  -> Codex turn/interrupt
```

The existing HTTP contract is `/api/orchestration/dispatch`, and the command
is `thread.turn.interrupt`. The current web Auto Resend logic is intended to:

```text
stale text-only turn with no tool activity
  -> native interrupt
  -> wait for stopped state/receipt
  -> resend the unchanged prompt through native thread.turn.start
```

If tools, approvals, user input, or image attachments are involved, the system
must warn and request review rather than stop and resend automatically.

The remaining work is:

- finish the native sideband interrupt command;
- expose a clear native receipt to Portfolio Control;
- test accepted, stopped, delayed, failed, and uncertain cases;
- ensure no hidden app-session retry cap exists; and
- simplify VoiceTools exact-target sending so it does not perform unnecessary
  inventory, peer, readiness, or transcript gates before native dispatch.

VoiceTools may remain a narrow title/Passport resolver and receipt adapter. It
must not be the only path for native agent messaging.

## New Rotations feature

Rotations should be a first-class Portfolio destination, separate from Agents.
Agents remains the inbox/session view. Rotations becomes the cross-agent health
and lifecycle view.

Recommended Portfolio order:

```text
Heartbeats
Rotations
Tasks
Wishlist
Agents
Host Health
Storage
Projects
Documents
Trajectory
Rants
```

### Rotations list

Each row should use real native T3 data and show:

- agent/session title;
- project and host;
- current context usage;
- total processed tokens;
- telemetry freshness;
- last rotation date;
- current role/worker;
- rotation state; and
- one `Rotate` action.

States should follow the existing Agents Dev Guidelines lifecycle:

```text
Healthy
Watch
Rotation required
Rotation requested
Handoff ready
Successor created
Intake in progress
Overlap proof
Cutover ready
Active successor
Blocked
Unavailable
```

The list should use the existing native token thresholds:

- 150m: watch;
- 200m: rotation required;
- 220m–300m: frequent reminders;
- above 300m: urgent rotation.

Behavioral warnings should also be visible: repeated answers, stalled work,
poor readback, lost ownership boundaries, or a clean phase boundary.

### Single-click rotation

Clicking `Rotate` should send one bounded request to the current rotation
worker. It should not directly kill, archive, rename, or replace the target.

The request should include:

- a stable `rotation_id` and idempotency key;
- exact target title, project, host, and native T3 thread identity;
- current token/context readings and freshness;
- reason for rotation;
- current role and role packet;
- standards document paths and their Git revision;
- required skills;
- preferred context-ingestion method;
- fallback message count if token-bounded readback is unavailable;
- required handoff/intake/overlap/cutover receipts; and
- stop conditions.

The button changes immediately to `Rotation requested` after native dispatch and
shows the dispatch receipt. An uncertain request must be reconciled before a
retry; it must not create a duplicate successor.

### Versioned rotation worker and standards

The button must resolve the current rotation worker by role ID, not by a stale
hard-coded session title. The role record should point to:

- the current visible rotation-worker T3 session;
- its project and host;
- the role packet;
- the rotation policy;
- required skills;
- standards documents; and
- the Agents Dev Guidelines Git revision.

When the rotation worker is itself rotated, the role registry is updated to
the successor. Future clicks resolve the new worker automatically.

The request should instruct the worker to read the current standards and role
documents before acting. Until bounded token-based readback is available, the
role may specify a configurable fallback such as the latest 50 messages. The
chosen count must be recorded in the receipt and must not be presented as a
complete history.

### Rotation lifecycle

The worker follows the existing Plan 006/007 lifecycle:

```text
active
  -> rotation_proposed
  -> handoff_requested
  -> handoff_ready
  -> handoff_audited
  -> successor_created
  -> intake_in_progress
  -> overlap_proof
  -> cutover_ready
  -> active_successor
  -> outgoing_read_only/retired
```

`blocked` can occur at any stage. There must be only one active occupant after
cutover. Session creation alone does not grant role authority.

The first T3 implementation should be read-only: show the list, reason, status,
and standards links, then preview the generated prompt. The next slice can wire
the button to the current rotation worker through native T3 dispatch after the
worker identity is represented by an exact current role record.

## Storage monitoring and cleanup

The Storage destination should eventually measure, read-only:

- T3 SQLite and WAL;
- orchestration events and thread-activity payloads;
- Codex rollout/session storage;
- attachments and images;
- caches and build output;
- managed worktrees; and
- unknown or inaccessible paths.

Each result needs path, category, bytes, age, and active/inactive/unknown
state. The following cleanup classes should be used later:

- active/live: never clean automatically;
- recoverable: quarantine or move to Trash;
- rebuildable cache: remove only after the owner is stopped;
- generated artifact: remove only with a retained receipt;
- unknown: report only.

No direct SQL deletion, live `VACUUM`, automatic cleanup, or Heartbeat-driven
deletion is part of the first inventory slice.

## Help and Workflows

The current workflow catalog is useful but hard-coded. It should become a
small file-backed catalog with stable IDs and source links for:

- Git and workspace lifecycle;
- skills and operating rules;
- agent rotation and handoff;
- maintenance, cleanup, and repair;
- disk footprint and session storage;
- stop-stale-turn recovery;
- context-token and rotation health;
- Heartbeat operation;
- Task/Wishlist review; and
- owner transfer and receipts.

Every workflow should state purpose, inputs, permitted actions, stop
conditions, evidence, and source revision.

The exact AVTransform vNext workflow screen was not available in the inspected
source trees, so the current work follows the T3 visual language. A later
visual comparison can improve styling without changing the authority model.

## Projects, Documents, Trajectory, and Rants

These remain later Portfolio destinations:

1. Native project browser using configured T3 project roots.
2. Allowlisted Markdown and numbered-plan viewer.
3. Trajectory navigation with links to Tasks and Wishlist.
4. Typed Rant capture preserving original wording.
5. Reviewable Rant-to-proposal flow.
6. Selective promotion into an authoritative Task, Wishlist item, or
   trajectory proposal.

A Rant must not silently overwrite a trajectory document.

## Realtime Assistant

The VoiceTools Realtime Assistant is an existing system and remains later
work. Once Heartbeats, Tasks, receipts, token health, and attention signals are
dependable, T3 can expose the existing Assistant through the desktop/mobile
shell.

The Assistant should read Portfolio and native T3 state through explicit APIs
and route approved actions through the same native T3 dispatch and receipt
paths. It must not become a second scheduler, session registry, or execution
runtime.

## Recommended implementation order

1. Finish and validate the native sideband interrupt command.
2. Add the read-only Rotations destination and pure rotation-status model.
3. Add rotation prompt preview with versioned standards links.
4. Implement the VoiceTools Portfolio owner descriptor and disabled Mac-owned
   snapshot transfer contract.
5. Display real owner-backed Heartbeat records in T3.
6. Prove one disabled Heartbeat through native T3 dispatch and receipt.
7. Connect real Tasks and Wishlist records.
8. Finish storage measurement and a dry-run cleanup preview.
9. Finish token/rotation alert state and cross-host notifications.
10. Convert Help & Workflows to a file-backed catalog.
11. Add Projects, Documents, Trajectory, and Rants.
12. Integrate the existing Realtime Assistant into T3.

## Non-goals and prohibitions

- Do not create a second Heartbeat scheduler.
- Do not create a second Portfolio or session database.
- Do not use VoiceTools as the sole native messaging path.
- Do not activate Heartbeats during source or transfer work.
- Do not automatically create, rename, archive, or cut over agents from the
  first Rotations button.
- Do not treat a fixed message window as complete context.
- Do not write T3 SQLite directly.
- Do not delete storage or repair the live database from Portfolio Control.
- Do not modify the installed official T3 app.
- Do not rebuild the existing Realtime Assistant.

## Source documents

- `docs/t3-portfolio-heartbeat-first-roadmap-2026-08-17.md`
- `docs/portfolio-control-expansion-plan-2026-08-16.md`
- `docs/t3-voicetools-messaging-and-portfolio-foundation-consolidation-2026-08-16.md`
- `docs/voicetools-portfolio-heartbeat-port-map-2026-08-15.md`
- `docs/t3-portfolio-global-navigation-design.md`
- `agents-dev-guidelines/DOCS/DEVELOPMENT_PLANS/006_ROLE_LIFECYCLE_REGISTRY_VALIDATION_AND_ROTATION_HELPER_2026-07-28.md`
- `agents-dev-guidelines/DOCS/DEVELOPMENT_PLANS/007_ENFORCED_AGENT_ROTATION_WORKFLOW_SKILL_CONTROLLER_AND_CUTOVER_GATES_2026-07-30.md`
- `agents-dev-guidelines/agent_roles/ROTATION_AUTOMATION_CONTRACT.md`
