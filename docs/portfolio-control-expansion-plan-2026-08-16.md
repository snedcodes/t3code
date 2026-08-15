# Portfolio Control expansion plan

Date: 16 August 2026
Status: implementation plan and worker brief pack

## Goal

Grow the native T3 Portfolio shell into a useful read-only control surface for
workflows, agent health, disk footprint, context-token rotation, and safe turn
recovery. Keep T3 as the native agent/session surface. Keep VoiceTools as the
temporary authority for Portfolio records, Heartbeats, cross-host state, and
phone alerts until each contract is ported and proved.

## Current baseline

- Portfolio mode, Heartbeats-first destinations, native Agents/inbox linkage,
  Host Health context, and draft destinations are working in T3.
- Switching between Portfolio and Agents now preserves the normal sidebar and
  chat tree instead of remounting it.
- Help & Workflows is a read-only catalog. It now includes Git, skills,
  rotations, maintenance, disk footprint, stop-turn recovery, and token health.
- Heartbeats remain paused. Tasks, Wishlist, and VoiceTools host health are
  honest placeholders.
- Plan 568 found that the active T3 store is about 6.1 GB. The main consumers
  are `orchestration_events` (~2.88 GB) and
  `projection_thread_activities` (~2.36 GB), mostly duplicated provider/tool
  JSON rather than visible message text.
- Plan 568 also confirmed that native T3 dispatch should own execution. A
  VoiceTools pre-send projection scan must not become a delivery gate.
- Native T3 already has token-usage data and a provider interrupt path. The
  Portfolio display and operator-facing recovery workflow are not complete.
- The exact AVTransform vNext workflow screen source was not found in the
  accessible source trees. The catalog currently follows the T3 Portfolio
  visual language; the AVTransform visual match remains a reference task.

## Work order

### Slice 1 — workflow/help catalog depth

Owner: T3 web

Turn the current cards into a small file-backed catalog. Each workflow should
have a stable ID, title, purpose, when-to-use text, inputs, permitted actions,
stop conditions, evidence/receipt fields, and links to its authoritative
document. Start with:

1. Git and workspace lifecycle
2. Skills and routine operating rules
3. Agent rotation and handoff
4. Maintenance, cleanup, and repair
5. Disk footprint and session storage
6. Stop a stale native T3 turn
7. Context-token and rotation health

The first version remains read-only. It must not copy the full central
guidelines into T3 or create a second registry.

Finish line: an agent or user can open one workflow and see the exact next
action, the source document, and what evidence proves completion.

### Slice 2 — native disk-footprint inventory

Owner: T3 server/web

Add a read-only inventory for the host/environment that T3 already owns. It
should measure categories rather than silently scanning the whole computer:

- active T3 state and projection database files;
- orchestration event and thread-activity payloads, including high-volume
  `tool.completed` data;
- Codex rollout/session storage;
- attachments and image payloads;
- caches and generated build/dist output;
- managed worktrees and temporary build workspaces;
- unknown or inaccessible paths.

Every row needs path, category, bytes, age, active/inactive/unknown state, and
source timestamp. The first implementation must use an existing T3-owned
filesystem/runtime seam or a clearly bounded server-owned read operation. It
must not read another host's SQLite directly, modify the live profile, or add
automatic cleanup. T3's live event/activity database cannot be repaired by
deleting rows from the Portfolio UI.

Finish line: Portfolio shows a truthful per-category size report and labels
unavailable data instead of guessing.

### Slice 3 — cleanup preview and retention policy

Owner: T3 web plus workflow catalog

Define classes before adding any delete action:

- active/live: never clean automatically;
- recoverable: move to Trash or an approved quarantine location;
- rebuildable cache: removable after confirming the owning process is stopped;
- generated artifact: removable only when its receipt is retained;
- unknown: report only.

Add a dry-run preview showing candidates, reason, expected recovery, and
recovery path. For T3 event/activity history, the only acceptable later
cleanup path is a T3-owned retention/export/rebuild design with projector and
event-replay tests. Direct SQL deletion, live `VACUUM`, or replacing the live
database are explicitly out of scope. User-triggered cleanup comes later. No
background cleanup or Heartbeat may delete files in this phase.

Finish line: a user can review a cleanup proposal without changing the disk.

### Slice 4 — native context-token health

Owner: T3 web first; VoiceTools integration later

Use the existing native context-window activity and `totalProcessedTokens`.
Do not estimate tokens from transcript text. Show the selected session's
current context, total processed tokens, freshness, and a simple rotation
state. Use Plan 563's policy:

- 150m: watch;
- 200m: rotation required;
- 220m through 300m: 20m reminders;
- above 300m: 10m reminders.

The first T3 slice is display-only. Durable cross-host alert state, dedupe,
acknowledgement, phone alerts, and TTS remain VoiceTools work.

Finish line: one native T3 session's existing meter is visible in Portfolio
without a competing token counter.

### Slice 5 — stop-turn recovery

Owner: T3 web/server

Expose the existing native interrupt capability as a clear operator action in
the selected agent/session view. The flow should be:

```text
turn appears stale
  -> show current turn status and Stop turn
  -> interrupt the native turn
  -> wait for the cancelled/stopped receipt
  -> show whether resend is safe
```

Do not resend automatically. Do not use VoiceTools as a substitute transport.
Keep provider-specific behavior inside the existing adapter/provider service
boundary.

Finish line: a user can stop a stale native turn and see a truthful result
before deciding whether to send again.

### Slice 5a — direct-dispatch contract

Owner: T3 server/provider seam, then VoiceTools wrapper

Carry forward Plan 568's separation:

- T3 native orchestration accepts and executes the turn;
- VoiceTools resolves a title or Passport and submits one native dispatch;
- acceptance/dispatched state is the execution receipt;
- projected transcript readback is downstream confirmation, not a pre-send
  veto;
- projection-turn diagnostics remain an explicit recovery/status tool.

Add fixture tests for accepted dispatch with delayed or missing projected
messages. Do not add broad inventory, readiness, or transcript polling to the
normal send path.

Finish line: a native dispatch cannot be incorrectly blocked or duplicated
because the projection is temporarily behind.

### Slice 6 — VoiceTools Portfolio owner seam

Owner: VoiceTools Portfolio State Owner

This must precede real Tasks, Wishlist, and Heartbeat activation. Follow Plan
561 and Plan 564:

- choose one explicit owner backend;
- make non-owner hosts read/proxy that owner or report unavailable;
- preserve task-to-Passport and task-to-Heartbeat bindings;
- transfer the existing disabled Mac snapshot only through a checked,
  idempotent owner contract;
- prove one disabled task-bound Heartbeat can deliver once and self-stop.

Finish line: one task and its disabled Heartbeat survive owner restart and
readback with a truthful receipt. Heartbeats remain paused until then.

### Slice 7 — real Portfolio records and maintenance Heartbeats

Owner: VoiceTools after Slice 6

Port Rants, Tasks, Wishlist, and authoritative Heartbeat state in the order
specified by Plan 564. A later maintenance Heartbeat may inspect disk and
rotation health, but it should initially report candidates only. It must not
delete, rotate, create agents, or dispatch work without the approved contract.

## Worker setup

Prepare these as separate visible T3 workers. Do not create duplicate workers
for the same lane.

| Worker title                     | Repository                              | Owns                                                                                            | Does not own                                              |
| -------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| T3 Portfolio Workflow Surface    | `t3-snedcodes-dev`                      | file-backed Help & Workflows catalog                                                            | VoiceTools state or cleanup                               |
| T3 Native Context and Stop Turn  | `t3-snedcodes-dev`                      | token display and native interrupt UX                                                           | token estimation or Heartbeat activation                  |
| T3 Storage Footprint Inventory   | `t3-snedcodes-dev`                      | bounded read-only inventory of session files, T3 event/activity payloads, caches, and artifacts | deletion, cleanup, live SQL repair, or foreign-host reads |
| T3 Direct Dispatch Contract      | `t3-snedcodes-dev` plus VoiceTools seam | native acceptance/receipt fixtures and optional readback semantics                              | broad preflight, polling, or a second transport           |
| VoiceTools Portfolio State Owner | `VoiceToolsSuite`                       | Plan 561 owner seam and receipts                                                                | T3 UI or automatic Heartbeats                             |
| VoiceTools Heartbeat Port        | `VoiceToolsSuite`                       | faithful Heartbeat behavior after owner proof                                                   | new scheduler, broker, or parallel registry               |
| Portfolio Rants and Tasks        | `VoiceToolsSuite`                       | durable Rant/task/Wishlist records after owner proof                                            | T3 runtime changes                                        |

Recommended order is Workflow Surface, Native Context and Stop Turn, Storage
Footprint Inventory, and Direct Dispatch Contract in parallel. The VoiceTools
State Owner starts next. Heartbeat and Rants/Tasks depend on its owner proof.
The Portfolio UI worker integrates only after backend fixtures or truthful
unavailable states exist.

## Worker handoff requirements

Every worker must return:

- exact visible T3 title and project;
- owned files and unrelated dirty-state preserved;
- source evidence read;
- focused tests/checks;
- one realistic use where viable;
- exact remaining gap and next safe action.

Workers must not create hidden sessions, write T3 SQLite directly, add a
second scheduler/registry/broker, activate Heartbeats, delete storage, send
external messages, or launch the official installed T3 app.

## Source references

- `docs/t3-portfolio-global-navigation-design.md`
- `docs/voicetools-portfolio-heartbeat-port-map-2026-08-15.md`
- `agents-dev-guidelines` Plan 016: skills and Portfolio operating model
- `agents-dev-guidelines` Plans 006 and 007: rotation lifecycle and controller
- VoiceTools Plan 561: Portfolio/Heartbeat owner seam
- VoiceTools Plan 563: native context-token rotation health
- VoiceTools Plan 564: Rants, Tasks, context alerts, and T3 shell
- VoiceTools Plan 568: T3 storage and direct-dispatch audit
- `agents-dev-guidelines/TECHNIQUES/2026-05-26_agent_operable_workflow_surfaces.md`
