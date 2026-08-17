# T3 Portfolio and Heartbeat roadmap

Date: 17 August 2026  
Status: active roadmap; Phase 0 native T3 foundation and a read-only Phase 2 seam are partly implemented

## Purpose

This is the start-to-finish plan for turning the current T3 Portfolio shell
into the user's main portfolio workspace.

Heartbeats come first. VoiceTools already has the Heartbeat system, so the
work is a faithful port and integration, not a new scheduler. The first owner
will be the Mac VoiceTools backend because that is where the existing records
currently live. The state and owner contract must make a later Mac-to-VPS
transfer straightforward. The VPS is the intended long-term owner.

T3 remains the native surface for projects, threads, provider turns,
interrupts, and execution. VoiceTools temporarily owns the existing Portfolio
and Heartbeat records and owner routing. It must not become a second T3
session store or a mandatory pre-send gate.

## What is already done

The current T3 dev branch already contains:

- top-bar Agents and Portfolio navigation;
- native Agents navigation using T3 projects and threads;
- a Heartbeats-first Portfolio destination list;
- Host Health context with honest VoiceTools-unavailable wording;
- draft destinations for Projects, Documents, Trajectory, and Rants;
- a basic read-only Help & Workflows catalog;
- native turn interruption through the existing T3 Stop path; and
- per-thread Auto Resend with per-turn recovery protection.

These are useful foundations, not the finished Portfolio system. The current
workflow catalog is still hard-coded, the Portfolio records are placeholders,
and Heartbeats are not connected or active.

### 17 August implementation receipt

- `f99212577` adds the paused Heartbeat target foundation. It derives up to 20
  selectable targets from real native T3 project/thread shells, with active
  sessions first. It adds no scheduler, persistence, polling, VoiceTools call,
  or activation.
- `6aac093b0` adds native context/rotation status for the selected target from
  existing `context-window.updated` activities. It shows real context used,
  total processed tokens, and the Plan 563 watch/rotation thresholds; missing
  telemetry is shown as unavailable rather than estimated.
- `013dd829f` links each selectable Heartbeat target to its existing native T3
  thread without starting a turn.
- The current owner slice adds `apps/web/src/portfolioHeartbeatOwner.ts`.
  It models the Plan 561 `portfolio_heartbeat` descriptor and the explicit
  `owner`/`non_owner`/`owner_unavailable` roles. The UI currently supplies no
  VoiceTools data, so it truthfully shows `Not connected`; it does not infer an
  owner or create local Portfolio state.
- `d99b5c54d` adds a paused, non-persistent configuration draft for each
  selected native target. It names cadence, run limit, expiry, finish line,
  allowed actions, stop conditions, and receipt owner without inventing values.
- `62be463e6` makes Help & Workflows selectable and gives each workflow stable
  inputs, permitted actions, stop conditions, evidence, and source fields.
- `339440865` adds the visible Storage destination. It lists the planned
  bounded categories and clearly says that no scan, polling, cleanup, or
  database operation is connected yet.
- Focused checks passed: 19 web tests, web typecheck, diff check, and web
  production build under the existing Node 24 installation. The build emits
  the repository's existing large-chunk warnings but completes successfully.
- An isolated disposable web stack started and migrated successfully, but the
  controlled preview could not complete DOM snapshot/click automation in this
  environment. No shared T3 profile or VoiceTools runtime was touched.

## Target architecture

```text
T3 Portfolio UI
  -> one configured Portfolio/Heartbeat owner
  -> VoiceTools owner API while the records remain there
  -> canonical T3 environment + thread identity
  -> ordinary native T3 thread.turn.start
  -> native T3 timeline and turn receipt
  -> owner-routed Heartbeat/Portfolio receipt
```

The ownership model is:

| Area                                                     | Temporary authority        | Long-term authority                              |
| -------------------------------------------------------- | -------------------------- | ------------------------------------------------ |
| T3 projects, threads, turns, provider state              | Native T3                  | Native T3                                        |
| Portfolio Tasks, Wishlist, Rants, and Heartbeat settings | VoiceTools Mac backend     | VoiceTools VPS backend, after transfer           |
| T3 Portfolio presentation                                | T3 web                     | T3 web                                           |
| Native turn dispatch                                     | T3 orchestration           | T3 orchestration                                 |
| Phone alerts and optional TTS                            | VoiceTools                 | VoiceTools, until separately ported              |
| Realtime Assistant                                       | Existing VoiceTools system | Existing VoiceTools system, later surfaced in T3 |

There must be one owner for the Portfolio/Heartbeat state domain at a time.
Non-owner hosts either read/proxy the owner or clearly report that the owner
is unavailable. They must never return an empty local ledger as if it were the
truth.

## Phase 0 — keep the current T3 foundation usable

Owner: T3 web

Keep the current navigation and native thread behavior stable while the
Heartbeat work begins.

Tasks:

1. Keep Agents linked to the normal T3 inbox/project-thread view.
2. Keep Heartbeats visible as paused when the owner is unavailable.
3. Correct the Help & Workflows copy so it describes the current Auto Resend
   behavior accurately.
4. Keep Tasks, Wishlist, VoiceTools Host Health, and later Portfolio sections
   clearly labelled as connected-later or draft until their source is ready.
5. Keep all T3 and VoiceTools changes in their own repositories.

Finish line: the T3 shell remains usable while all unavailable data is shown
truthfully.

## Phase 1 — document and fixture the existing VoiceTools Heartbeat contract

Owner: VoiceTools source, with T3 integration notes

Use the existing implementation as the source of truth:

- `HeartbeatService` in `voicetools/api/heartbeat_service.py`;
- `runtime/heartbeat_settings.json` for Heartbeat settings;
- `PortfolioLedger` in `voicetools/api/portfolio_task_contract.py`;
- `runtime/portfolio_task_ledger.json` for Tasks, Wishlist, and related
  records;
- `/api/assistant/heartbeat/status` and settings routes;
- owner-routed/federated Heartbeat target routes; and
- the existing direct sender in `server.py` and `codex_command_service.py`.

Record fixtures for:

- interval, daily, and weekly cadence;
- maximum runs and run count;
- expiry;
- goal and finish-line text;
- pause, stop, completion, blocked, and expired states;
- overlap prevention;
- target resolution state;
- delivery and transcript receipts; and
- historical queued/sending/uncertain receipts.

Do not reinterpret old receipts as successful delivery. Do not enable a
target while creating the fixtures.

Finish line: the existing VoiceTools behavior has focused tests and a clear
mapping to the T3/native dispatch contract.

## Phase 2 — add the transferable owner seam

Owner: VoiceTools Portfolio State Owner

The Mac is the initial owner. Build the contract so the VPS can become owner
without rewriting records or changing Heartbeat meaning.

The owner descriptor must contain:

- owner host UUID and base URL;
- owner epoch and monotonic revision;
- Portfolio ledger revision and checksum;
- Heartbeat settings revision and checksum;
- transfer ID and timestamp; and
- owner status: `owner`, `non_owner`, or `owner_unavailable`.

Normal reads and writes must behave as follows:

```text
owner host       -> read/write its authoritative state
non-owner host   -> proxy to owner or return owner-unavailable
owner unavailable -> do not substitute local empty state
```

The transfer sequence is:

1. Keep all Heartbeats paused.
2. Stop owner writes for the short transfer window.
3. Read the Mac ledger/settings and calculate source revisions/checksums.
4. Stage the exact snapshot on the VPS in a disabled state.
5. Verify IDs, records, disabled lifecycle states, revisions, checksums, and
   task-to-Heartbeat references.
6. Advance the owner epoch and activate the VPS as owner.
7. Make Mac and Windows read/proxy the VPS owner.
8. Read all hosts and prove that they report the same owner epoch and source
   checksums.
9. Keep Heartbeats paused after the transfer.

Rollback to the Mac owner if the staged snapshot differs, the owner epoch
conflicts, a host still serves stale local state, or any target becomes
enabled unexpectedly. Do not overwrite either source with an empty store.

Finish line: Mac owns the unchanged disabled state first, and a tested,
disabled Mac-to-VPS transfer can be repeated idempotently.

## Phase 3 — bring real Heartbeats into T3 Portfolio Control

Owner: T3 web plus the VoiceTools owner adapter

This is the first major user-facing implementation phase.

The T3 Heartbeats view should show real owner-backed records while making the
authority obvious:

- owner host and freshness;
- global paused/enabled state;
- target list and target status;
- exact native T3 target title, project, host, and Passport identity where
  available;
- cadence;
- maximum runs, current run count, and expiry;
- finish-line and stop-condition text;
- overlap setting;
- last receipt and receipt state; and
- unavailable or stale labels.

Target selection must come from real native T3 projects and thread shells. T3
must not create a second session registry. VoiceTools target identity may keep
its Passport and owner coordinates, but the actual execution target must be a
canonical native T3 environment/thread.

At first, the Portfolio view is read-only and every target remains paused.
The UI may show the existing controls as disabled or connected-later until
the native dispatch and receipt proof is complete.

Finish line: T3 can display the existing Mac-owned Heartbeat configuration
without inventing records or activating work.

## Phase 4 — replace only the delivery path with native T3 dispatch

Owner: T3 orchestration seam plus VoiceTools adapter

Preserve the existing VoiceTools schedule, lifecycle, overlap, and receipt
rules. Replace the delivery mechanism only:

```text
Heartbeat due
  -> resolve one exact Passport/native T3 target
  -> submit normal native thread.turn.start
  -> receive native acceptance/dispatch receipt
  -> optionally read the resulting native transcript downstream
  -> record a truthful Heartbeat receipt
```

Receipt states must distinguish:

- accepted;
- dispatched;
- transcript-confirmed;
- confirmation-delayed or uncertain; and
- failed before acceptance.

A delayed projection must not block an accepted native dispatch or cause a
blind resend. A retry is allowed only for a definite transport failure and
must reuse the same client message identity. A transport failure must not
silently pause, complete, exhaust, or disable a Heartbeat.

Add fixture tests for delayed projection, missing projection, duplicate
dispatch, definite transport failure, target mismatch, and owner-unavailable
responses.

Finish line: one disabled Heartbeat can be run in an isolated proof and
produce one native T3 turn plus a truthful linked receipt. No real Heartbeat
is activated during this source phase.

## Phase 5 — controlled Heartbeat lifecycle proof

Only after Phases 1–4 pass:

1. Use one existing non-critical target.
2. Keep all other targets paused.
3. Start one explicitly bounded proof with a maximum run count and expiry.
4. Confirm the message appears in the normal native T3 thread.
5. Confirm the receipt and target run count.
6. Confirm the declared completion or self-stop condition.
7. Confirm that no duplicate turn was created.
8. Pause the proof target again and record the receipt.

Do not create agents, add a scheduler, or run a broad multi-target test in
this phase.

Finish line: one existing Heartbeat behavior has survived owner routing,
native T3 dispatch, readback, and bounded self-stop.

## Phase 6 — Tasks and Wishlist

Owner: VoiceTools state owner, then T3 Portfolio UI

After the owner seam is proven, connect the existing Task/Wishlist ledger to
T3. Preserve the VoiceTools contract rather than creating a T3 database.

Implement:

- task and Wishlist lists;
- status, owner, checklist, completion condition, and receipts;
- Markdown document links;
- task-to-Passport binding;
- task-to-Heartbeat binding;
- reviewable promotion from Wishlist to Task; and
- clear owner/freshness labels in T3.

Do not allow a Wishlist item or Task to claim an agent or activate a
Heartbeat automatically merely because it exists.

Finish line: one real Task can be viewed in T3, linked to one native target,
and show its authoritative receipt history.

## Phase 7 — token and rotation health

Owner: T3 web first, VoiceTools alerts later

Use native T3 token telemetry. Do not estimate tokens from transcript text.

First show in T3:

- current context usage;
- total processed tokens;
- freshness;
- native source;
- watch state at 150m; and
- rotation-required state at 200m and later policy buckets.

Then add the VoiceTools owner-routed alert state, dedupe, acknowledgement,
phone notifications, and optional TTS. The T3 card and phone card must use
the same owner-backed alert state rather than two competing counters.

Finish line: one non-critical session shows the same native value in T3 and
VoiceTools, with one alert per threshold.

## Phase 8 — storage visibility and cleanup preview

Owner: T3 server/web

Add a bounded, read-only storage inventory for T3-owned paths:

- T3 SQLite and WAL;
- orchestration event and thread-activity payloads;
- Codex rollouts/session storage;
- attachments/images;
- caches and generated build output;
- managed worktrees; and
- unknown or inaccessible paths.

Show path, category, bytes, age, and active/inactive/unknown state. Do not
scan another host's database directly.

The next slice is a dry-run cleanup preview with a reason and recovery path.
No automatic cleanup, direct SQL deletion, live `VACUUM`, or Heartbeat-driven
deletion is allowed until T3 has a supported retention/export/rebuild design.

Finish line: the user can see where disk space is going and review a cleanup
proposal without changing the disk.

## Phase 9 — workflows, projects, documents, trajectory, and Rants

Owner: T3 presentation plus VoiceTools Portfolio records

Expand the current Help & Workflows catalog into a small file-backed catalog
with stable IDs, source links, inputs, permitted actions, stop conditions,
and receipt fields.

Then implement the later Portfolio areas in this order:

1. Project browser using configured native project roots.
2. Allowlisted Markdown document and numbered-plan viewer.
3. Trajectory navigation with links back to Tasks and Wishlist.
4. Typed Rant capture preserving the original wording.
5. Agent distillation as a reviewable proposal.
6. Selective promotion into Wishlist, Tasks, or a trajectory proposal.

Voice/audio capture comes later through the existing VoiceTools Assistant
seams. A Rant must never silently overwrite a trajectory document.

Finish line: one project can be browsed, one Rant can be captured, one
proposal can be reviewed, and one selected result can become an authoritative
Task or Wishlist record.

## Phase 10 — messaging cleanup and recovery convergence

Keep ordinary coordination native to T3. VoiceTools may resolve a human title
to the exact Passport/owner/native route and submit one direct command, but it
must not add broad pre-send readiness, peer inventory, transcript, or phone
checks after exact resolution.

Keep the current native Stop control. The recovery rules are:

- active tools or native progress: do not stop automatically;
- approval or user input: do not stop automatically;
- stale turn with tool activity: warn and request review only;
- stale text-only turn with no newer native progress: Auto Resend may use the
  native interrupt, wait for the stopped receipt, and resend once for that
  turn;
- uncertain dispatch: do not blindly resend; reconcile first.

The earlier Plan 565 source patch remains on its separate branch and should be
compared before any cross-host recovery work is merged.

Finish line: normal T3 messaging, native interruption, and VoiceTools
receipts agree about what was accepted, stopped, confirmed, delayed, or
failed.

## Phase 11 — existing Realtime Assistant in T3

This is a later integration phase. The Realtime Assistant already exists in
VoiceTools; it is not to be rebuilt.

After the Portfolio owner, Heartbeats, Tasks, receipts, and attention signals
are dependable:

1. expose the existing Assistant API through the T3 desktop/mobile shell;
2. add a compact Assistant/Portfolio attention surface;
3. preserve the existing VoiceTools realtime audio/session behavior;
4. let the Assistant read Portfolio and native T3 state through explicit
   APIs; and
5. route approved actions to the same native T3 dispatch and receipt paths.

Do not make the Assistant a second scheduler, session registry, or execution
runtime.

## Autonomous work order

Work can proceed without asking for a new prompt between ordinary source,
documentation, fixture, and isolated-test slices:

1. T3 workflow-copy correction and this roadmap receipt.
2. VoiceTools Heartbeat contract fixtures and owner seam.
3. T3 read-only Heartbeat view connected to the temporary Mac owner.
4. Native dispatch and receipt fixtures.
5. One disabled Heartbeat lifecycle proof.
6. Tasks/Wishlist owner-backed read surface.
7. Native token/rotation card.
8. Read-only storage inventory.
9. File-backed workflows and later Portfolio sections.
10. Messaging convergence and existing Assistant integration.

If a slice is blocked, continue with the next T3-only slice that does not
depend on it. Do not invent placeholder authority, duplicate state, or a new
transport to get around the dependency.

## Required receipt for every slice

Each implementation tranche records:

- repository and exact branch;
- files changed;
- source evidence used;
- focused checks and one realistic use where practical;
- owner and authority used;
- whether any Heartbeat was active;
- whether any external message was sent;
- exact remaining gap; and
- next safe slice.

## Protected boundaries

- Do not replace or modify the installed official T3 app.
- Do not run official and dev T3 against the same live profile at once.
- Do not create a second scheduler, broker, session registry, or Portfolio
  database.
- Do not write T3 SQLite directly.
- Do not activate Heartbeats during source or transfer work.
- Do not transfer owner state without checksums, revision checks, and a
  rollback snapshot.
- Do not use VoiceTools as the sole dependency for ordinary native T3
  messaging.
- Do not delete storage or run live database repair from the Portfolio UI.
- Do not rebuild the existing Realtime Assistant.

## Completion definition

This roadmap is complete when:

1. the Portfolio/Heartbeat owner can move from Mac to VPS without data loss;
2. T3 shows the authoritative Heartbeat state and native target identity;
3. one bounded Heartbeat reaches a normal native T3 thread and records a
   truthful receipt;
4. Tasks and Wishlist are visible without a duplicate ledger;
5. token and storage health are visible and honest;
6. workflows, projects, documents, trajectory, and Rants have useful native
   surfaces; and
7. the existing VoiceTools Realtime Assistant can later use these same native
   Portfolio and T3 execution paths.

## Source documents

- [Portfolio Control expansion plan](portfolio-control-expansion-plan-2026-08-16.md)
- [Messaging and Portfolio foundation consolidation](t3-voicetools-messaging-and-portfolio-foundation-consolidation-2026-08-16.md)
- [VoiceTools Portfolio and Heartbeat port map](voicetools-portfolio-heartbeat-port-map-2026-08-15.md)
- [Portfolio navigation design](t3-portfolio-global-navigation-design.md)
- VoiceTools Plan 543: Tasks, Wishlist, and task-bound Heartbeat control
- VoiceTools Plan 544: Project knowledge, Rants, Trajectory, and autonomous execution
- VoiceTools Plan 561: Configurable Portfolio and Heartbeat ownership
- VoiceTools Plan 563: Native context-window rotation health
- VoiceTools Plan 564: Rants, Tasks, context alerts, and T3 Assistant shell
- VoiceTools Plan 565: Pending-turn activation recovery and single retry
- VoiceTools Plan 566: Portfolio/Heartbeat single-owner implementation
- VoiceTools Plan 567: T3 red Stop and agent-callable interrupt control
- VoiceTools Plan 568: T3 storage and direct-dispatch audit
