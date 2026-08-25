# T3 Native Messaging, Session Health, Portfolio, and VoiceTools Retirement Plan

Date: 23 August 2026
Status: authoritative operating model and start-to-finish checklist

Updated 24 August 2026: native visible-worker creation is now proven through
the same orchestration system (`thread.create` followed by
`thread.turn.start`). VoiceTools is not required for worker creation.

This document reconciles the T3 Alpha, source Dev, mobile, multi-computer,
native messaging, context/session/storage health, Portfolio, Heartbeat, Tasks,
Rotations, and VoiceTools work.
Where an older roadmap conflicts with this document, use this document.

## Outcome

The finished system has one unsurprising control path:

```text
T3 client (desktop, web, mobile, or agent helper)
  -> exact T3 environment
  -> exact project
  -> exact existing thread
  -> native thread.turn.start
  -> dispatch receipt and optional target-thread readback
```

VoiceTools is not in that path. It remains available as a frozen migration
source while its useful TTS, realtime voice-assistant, and legacy Portfolio
data are moved into T3 deliberately.

The maintenance path is separate from messaging:

```text
selected T3 environment
  -> native context telemetry plus bounded host-owned storage inventory
  -> Portfolio Context / Rotations / Storage Health views
  -> explicit supported lifecycle or maintenance action
```

Monitoring never implies cleanup. Context pressure, transcript size, and
database size are different signals and must remain visibly distinct.

## Decisions that settle the current confusion

### 1. Mac Alpha is the daily live T3 owner

- Packaged Alpha owns `/Users/snedmusic/.t3` and port `3773`.
- It contains the current Mac projects, agents, threads, and preferences.
- The phone is paired to this Alpha environment.
- Alpha remains the stable daily control surface while source work continues.

### 2. Source Dev never shares Alpha's live profile

- Mac source Dev uses an isolated profile such as
  `/Users/snedmusic/snedcodes/t3-snedcodes-dev/.t3-client` and port `3774`.
- Dev may pair to Alpha and use Alpha's projects and threads as a remote
  environment. Pairing does not merge their local profiles.
- Never run Dev as a second owner of `/Users/snedmusic/.t3`, even on another
  port. A different port is an address, not state isolation.
- The Windows laptop and VPS source builds are also independent T3
  environments with their own profiles and stable lifecycle owners.

### 3. Source development happens on the VPS first

The Windows VPS source checkout is the primary place for T3 GUI/runtime work
that may rebuild or restart Dev. Changes move through Git. Mac Alpha remains
running while that work happens. A source change is promoted back to Mac only
after a focused VPS proof.

### 4. Native T3 is the only messaging transport

The operating instruction is:

```text
Use native T3 dispatch only.

Target an exact environment, project, and existing thread.
Do not use VoiceTools, the VoiceTools bridge, /api/codex, host_id routing,
title-only dispatch, or a guessed thread ID.
Send one message only.
Report the native receipt and, when requested, target-thread readback.
```

Basic messaging requires no new backend. The proven native route is:

```text
T3 CLI session auth
  -> live orchestration snapshot
  -> exact raw IDs
  -> POST /api/orchestration/dispatch
  -> thread.turn.start
  -> target thread readback
```

The native send capability is already proven and is the immediate operating
path. It does not depend on a separate sideband transport or a new backend.
The current usability gap is only that some agent sessions need the exact
authenticated shell/API procedure supplied explicitly.

Standardise that proven procedure now. A small first-class T3 command may be
extracted later to reduce repetition, but it is optional convenience—not a
prerequisite for native messaging or VoiceTools retirement. The historical
`sideband-send` work on `sned/t3-reliability-upstream-880` may be consulted for
useful exact-target and SSH patterns, but current T3 must not be blocked on
recovering it, restoring its removed `/api/auth/local-session` endpoint, or
cherry-picking its divergent contracts.

### 5. Alpha and VPS have different kinds of authority

- Mac Alpha is the canonical daily environment and client entry point.
- Each computer remains authoritative for its own local T3 projects, threads,
  provider sessions, and turns.
- The VPS source T3 environment is the intended single owner of future native
  Portfolio records and recurring Heartbeat scheduling.
- Mac, mobile, and the Windows laptop read and control that owner through the
  existing T3 environment connection runtime.

### 6. VoiceTools is retired by function, not destroyed at once

VoiceTools messaging is retired first. The repository and required runtime
remain recoverable while TTS, realtime assistant functions, and useful legacy
records are inventoried and ported. VoiceTools must not remain a live
Portfolio owner or a fallback message route merely because some useful voice
features still live there.

### 7. Context health, session footprint, and database growth are separate

- **Context health** is live provider telemetry for one thread: current
  `usedTokens`, provider context-window maximum, cumulative processed tokens,
  compaction support, and freshness. It informs rotation; it is not disk use.
- **Session footprint** is the on-disk size of Codex/Claude transcript files
  and archives. It can identify review candidates, but size alone never
  authorizes rotation, archive, or deletion.
- **Host storage health** covers T3 `state.sqlite` plus WAL/SHM, T3 logs and
  attachments, Codex `logs_2.sqlite` and state, declared caches, backups,
  worktrees, and build output. Protected active state is never presented as
  automatically reclaimable space.

Each T3 environment measures its own host on demand and returns a bounded
read-only result through the existing connection runtime. Portfolio aggregates
those environment-scoped results. Do not add a second session registry, a
continuous deep scanner, or a VoiceTools storage owner.

T3's existing Usage service already scans provider transcript files and caches
their `(size, mtime)` metadata. Reuse or narrowly extend that walk for session
footprint rather than starting another full-history scanner. Existing provider
event logs already enforce their own bounded retention; that does not imply
retention exists for every T3 log, transcript, attachment, or database.

## Current build receipt

| Area                                 | Current state                                                                                                                                                                                                          | Missing result                                                                                                                                                 |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mac daily runtime                    | Alpha on `3773` with `/Users/snedmusic/.t3`; phone paired                                                                                                                                                              | Keep this stable; no source rebuilds against the live profile                                                                                                  |
| Native messaging and worker creation | Same-host Alpha proof completed; Mac-to-Windows message completed; VPS proof recorded; authenticated snapshot/dispatch works; one visible coordinator was created with native `thread.create` plus `thread.turn.start` | Standardise both procedures, collect reverse-direction fleet receipts, and install native-only agent guidance; a packaged helper is optional convenience       |
| Remote environments                  | Mac, Windows laptop, and VPS have been paired through native T3                                                                                                                                                        | Clear labels and a small current fleet receipt                                                                                                                 |
| Dev lifecycle                        | VPS and Windows source profiles exist; source work can run separately                                                                                                                                                  | Make VPS the routine T3 development host and keep Mac Dev isolated                                                                                             |
| Dev stability                        | Source features exist, but image and diff previews have crashed Mac Dev through failed dynamic imports/Electron process errors                                                                                         | Repair and prove image plus diff preview on VPS before Mac promotion                                                                                           |
| Worker stop control                  | Native source-side worker/session stop control has been implemented                                                                                                                                                    | Promote only after VPS validation; Alpha does not receive source changes automatically                                                                         |
| Heartbeats                           | VPS Dev exposes authenticated owner and record readback; the VPS is the owner, but freshness is stale and no records exist                                                                                             | Refresh the owner, create one paused record targeting Alpha, manually dispatch it through native T3 and persist the readback receipt; scheduling remains later |
| Tasks                                | Typed Task/Wishlist contracts and compatibility tests exist                                                                                                                                                            | Persistence, owner-scoped API, web/mobile list and edits, and native dispatch                                                                                  |
| Rotations                            | Read-only environment-aware rows, telemetry, ordering, authority model, prompt preview, and ordinary native message control exist                                                                                      | No Rotate, successor, handoff, or cutover action exists                                                                                                        |
| Context health                       | Native Codex/Claude token snapshots expose current use, maximum, cumulative processed tokens, and freshness                                                                                                            | Fleet hydration is incomplete and the static processed-token warning thresholds need calibration against real provider data                                    |
| Session footprint                    | Usage already scans local provider transcripts with a durable `(size, mtime)` cache                                                                                                                                    | It reports usage, not per-session bytes, retention state, or cleanup candidates                                                                                |
| Storage Health                       | Portfolio has a truthful `Not connected` placeholder; provider event NDJSON logs have bounded retention                                                                                                                | No environment-scoped inventory API, real web/mobile view, eligible-record retention, or supported database compaction exists                                  |
| Wishlist                             | Contract exists; web still shows a preview                                                                                                                                                                             | Real native records, promotion to a targeted Task, and mobile read/write                                                                                       |
| VoiceTools                           | Still running; retained voice/data capabilities are not yet inventoried, and ordinary messaging guidance is not fully native-only                                                                                      | Prove current native reverse sends, reject new VoiceTools message dispatch, then update central and repository guidance before any backend shutdown            |

The 23 August Mac evidence snapshot measured approximately 7.25 GB of active
T3 `state.sqlite`, 728 MB of T3 logs, 376 MB of attachments, 6.8 GB of Codex
sessions, 1.30 GB of Codex `logs_2.sqlite`, and 677 MB of intentional Codex
backup data. These are protected measurements, not a deletion list, and must
be re-measured before any maintenance action.

## Start-to-finish checklist

The unchecked item nearest the top is the next work. Do not make later feature
work a prerequisite for reliable messaging.

## Current execution focus — 24 August

The VPS-to-Mac Alpha Heartbeat is now proven through the ordinary native
`thread.turn.start` path. Its repeated same-owner claim is fresh, its paused
record targets Alpha exactly, and its one manual run has a persisted receipt
and target readback. Command `c16b8ea1-e9d6-4e48-bf82-fc790ab03d21` reached
Alpha sequence `899693`; the target returned `HEARTBEAT_VPS_ALPHA_ACK` and the
VPS owner stored the result as `transcript-confirmed`.

Do not add a Heartbeat-specific transport, scheduler, controller, or new proof
programme. This receipt also counts as the required current VPS-to-Mac native
messaging receipt.

### Phase 1 — lock the operating topology

- [x] Use Mac Alpha on `3773` and `/Users/snedmusic/.t3` as the daily live
      environment.
- [x] Pair the phone to Mac Alpha.
- [x] Keep the Windows source Dev profiles separate from their packaged Alpha
      profiles.
- [ ] Confirm Mac Dev uses its isolated client profile on `3774` and is paired
      to Alpha before it is used again.
- [ ] Give the paired Mac entries distinct labels, including host and
      Alpha/Dev role, so operators do not select the wrong environment.
- [ ] Record the current Alpha, Windows laptop, VPS, and phone environment IDs
      in the lifecycle runbook. This is inventory, not a new registry.

### Phase 2 — converge messaging on native T3

- [x] Prove one Alpha agent can send to another Alpha thread without
      VoiceTools.
- [x] Prove Mac can send an ordinary native T3 message to the Windows laptop.
- [x] Record an earlier native VPS target proof.
- [ ] Send one current Windows-laptop-to-Mac message and capture receipt plus
      target reply.
- [x] Send one current VPS-to-Mac Heartbeat and capture receipt plus target
      reply. Do not repeat the earlier proof ladder.
- [ ] Put the exact currently proven authenticated
      connection/snapshot/dispatch/readback procedure in the reusable agent
      standard. It resolves exact environment/project/thread identity, sends once,
      and returns a concise native receipt.
- [ ] Use that same procedure for one local and one remote send from the VPS
      source environment. Do not make a new command a gate for these sends.
- [ ] Reconcile the central Agents Dev Guidelines contradiction: its root
      `AGENTS.md` and `CURRENT.md` still make VoiceTools the live coordination and
      route authority, while its current native sideband standard says VoiceTools
      is optional and must not be the ordinary message broker.
- [ ] Update relevant repository `AGENTS.md` guidance to name native T3 as the
      sole ordinary message route and point to the exact procedure plus behaviour
      guide.
- [x] Prove one requested visible worker can be created natively after an
      exact-title duplicate check, then seeded with `thread.turn.start`.
- [ ] Put that native duplicate-check/create/seed/readback procedure beside the
      messaging procedure in reusable agent guidance.
- [ ] Remove instructions that tell agents to use VoiceTools, `/api/codex`,
      host IDs, raw legacy session keys, or title-first dispatch for new sends.
- [ ] Optionally package the proven procedure as a small first-class T3 command
      after the fleet sends work. Historical sideband code may be used as reference
      but is not an acceptance gate.

Messaging is converged when every host can send through the same native
contract, a missing reply is distinguishable from a rejected dispatch, and a
VoiceTools outage has no effect on agent messaging.

### Phase 3 — retire VoiceTools messaging without losing VoiceTools

- [ ] Freeze a named recoverable VoiceTools source/data snapshot before
      removing message behavior.
- [ ] Inventory only the VoiceTools capabilities being retained: TTS,
      realtime voice assistant, relevant audio/voice configuration, and legacy
      Portfolio/Heartbeat/Task records required for import.
- [ ] Mark VoiceTools message APIs and bridge instructions deprecated and stop
      using them in active agent standards.
- [ ] Add an explicit VoiceTools configuration switch that rejects new message
      dispatch while leaving retained voice/read-only functions available.
- [ ] Turn that switch on after the remaining Windows-laptop reverse receipt
      and the manual VPS-to-Alpha Heartbeat receipt above are complete.
- [ ] Remove the VoiceTools bridge from normal T3 messaging startup and health
      expectations. Do not stop retained TTS/realtime services merely to retire
      messaging.

VoiceTools deletion is not part of this phase. The archived source remains
until every retained feature has a native replacement or an explicit keep
decision.

### Phase 4 — stabilise source Dev on the VPS

- [ ] Synchronise the VPS source checkout to the agreed shared branch and keep
      its separate T3 home and stable port.
- [ ] Reproduce and repair the image-preview dynamic-import failure on the VPS
      source build.
- [ ] Reproduce and repair the corresponding diff-preview failure and the
      Electron `EPIPE`/parent-process error path without restarting Mac Alpha.
- [ ] Prove one representative image preview and one representative diff in a
      real VPS Dev client.
- [ ] Validate the native worker stop control in the same VPS source build.
- [ ] Push the focused source changes. Pull them to Mac only after the VPS
      proofs; test Mac Dev as an isolated paired client, not as the live-profile
      owner.

### Phase 5 — add native context, session, and storage health

- [x] Preserve the existing native per-thread context-window telemetry and
      Rotations presentation.
- [x] Reuse the existing provider Usage scan and its per-file `(size, mtime)`
      cache rather than adding a second transcript scanner.
- [x] Preserve the existing bounded retention for provider event NDJSON logs;
      do not describe it as general T3/Codex cleanup.
- [ ] Make current context used/max percentage the primary rotation warning;
      keep cumulative processed tokens as secondary evidence. Calibrate the current
      static `150m`/`200m` processed-token thresholds from representative Codex and
      Claude telemetry before relying on them operationally.
- [ ] Add one authenticated, environment-scoped, on-demand Storage Health read
      endpoint for known bounded roots. Return path/category, bytes, file count,
      modified time, active/protected/candidate classification, owner, and any
      supported lifecycle action. Never return transcript or attachment content.
- [ ] Show the result in Portfolio Storage for the selected Mac, Windows
      laptop, or VPS environment. Keep context health, transcript footprint, and
      database footprint in separate sections.
- [ ] Add per-session or project-grouped transcript bytes by extending the
      existing Usage scan metadata. Do not scan all transcript contents merely to
      compute byte totals.
- [ ] Present exact archive/delete candidates only after a durable handoff and
      supported T3/Codex lifecycle state exist. No automatic rotation, archive, or
      deletion based on tokens, age, or bytes.
- [ ] Design and implement one T3-owned maintenance command for records already
      eligible under deleted/expired lifecycle state. It must quiesce the sole
      database writer, make the required rollback point, mutate only owned schema
      in one bounded transaction, run integrity/checkpoint/compaction, and report
      before/after bytes. Running it against live Alpha remains a separate explicit
      operator action.
- [ ] Keep Codex `logs_2.sqlite`, state databases, WAL/SHM, sessions,
      attachments, backups, Git state, and unknown roots protected unless Codex or
      T3 exposes a tested lifecycle/maintenance operation for that exact class.
- [ ] Do not make Heartbeats run cleanup. A later Heartbeat may report a health
      threshold, but maintenance stays explicit and owner-controlled.

### Phase 6 — finish native Heartbeats

- [x] Define exact native target, owner, receipt, and paused lifecycle
      contracts.
- [x] Implement owner read/claim and bounded native proof seams.
- [x] Make the VPS native T3 environment the direct initial Portfolio/
      Heartbeat owner. Do not require a Mac-to-VPS transfer ceremony when no
      canonical native owner needs transferring.
- [x] Implement canonical Heartbeat record persistence plus owner-scoped list
      and detail readback.
- [x] Prove that an identical same-owner claim refreshes `updatedAt` and leaves
      the VPS owner `fresh`.
- [x] Create one paused VPS-owned record with an exact existing Mac Alpha
      target. Do not introduce a Heartbeat-specific transport.
- [ ] Import the selected VoiceTools Heartbeat definitions once as paused
      native records. Preserve the source data; do not dual-write.
- [ ] Render the same owner-backed records in web/desktop and mobile.
- [x] Run one manually triggered, one-response native Heartbeat and persist its
      truthful dispatch/readback receipt.
- [ ] Add one VPS-owned scheduler only after the manual path works. Start with
      one record and one cadence, with visible pause/stop controls and no
      VoiceTools dispatch dependency.

### Phase 7 — finish Tasks and Wishlist

- [x] Keep the existing typed Task/Wishlist contracts and exact native target
      identity.
- [ ] Build one useful vertical slice: native persistence, owner-scoped API,
      and web/mobile list for one real Task. Do not insert another readback-only
      proof phase between these pieces.
- [ ] Add create/edit/status/checklist operations with monotonic revisions.
- [ ] Dispatch one Task to its exact native thread through the proven native T3
      path and store the native receipt separately from Task status.
- [ ] Add Wishlist records and promotion into a Task only after an exact native
      target is selected.
- [ ] Import selected VoiceTools Tasks/Wishlist records once; unresolved or
      ambiguous targets remain read-only until resolved.

### Phase 8 — resume Rotations after messaging, Heartbeats, and Tasks

- [x] Keep the existing read-only Rotations model and native ordinary-message
      control.
- [ ] Integrate the calibrated context warnings and optional transcript-byte
      evidence without treating either as automatic rotation authority.
- [ ] Skip additional preview-only ceremony. The next meaningful Rotations
      slice is one bounded, reviewed request for rotation sent to an exact native
      target with a native receipt.
- [ ] Add successor creation, handoff state, rename/archive, and cutover only
      after the first bounded request works and each reverse action is visible.

### Phase 9 — port retained voice features and close migration

- [ ] Port TTS into a T3-owned interface and prove desktop/mobile playback.
- [ ] Port the required realtime voice-assistant session functions without
      restoring VoiceTools as a message broker.
- [ ] Compare retained VoiceTools data with native Heartbeat/Task records and
      close any explicit import gaps.
- [ ] Remove retired VoiceTools messaging code and startup dependencies.
- [ ] Keep a recoverable archive or delete the remaining VoiceTools runtime
      only after the retained-feature checklist is complete.

## Immediate work allocation

1. **Coordinator on Mac Alpha:** use the persisted VPS-to-Alpha receipt plus
   the remaining laptop
   reverse receipt to retire VoiceTools from ordinary messaging: preserve the
   retained-capability inventory, enable rejection of new VoiceTools message
   dispatch, then update central and repository guidance coherently.
2. **Heartbeat lane on VPS:** keep the completed record paused and visible; add
   no scheduler until recurring Heartbeats are required.

Dev stability and Storage Health remain useful, but neither is a prerequisite
for the first manual Heartbeat or VoiceTools message retirement. Tasks follows
the Heartbeat proof; Rotations remains read-only.

## Minimal reading order

1. This consolidation plan.
2. [Architecture decision](t3-portfolio-control-architecture-decision-2026-08-19.md).
3. [Native messaging behaviour guide](t3-native-agent-messaging-behaviour-guide-2026-08-22.md).
4. [Lifecycle, ports, profiles, and messaging runbook](t3-portfolio-control-t3-lifecycle-and-messaging-runbook-2026-08-22.md).
5. For storage work, read the central
   [T3/Codex storage retention standard](../../agents-dev-guidelines/standards/2026-08-23_t3_codex_storage_retention_and_safe_cleanup.md)
   and the
   [Portfolio Git/session recovery plan](../../agents-dev-guidelines/DOCS/DEVELOPMENT_PLANS/014_PORTFOLIO_GIT_AND_SESSION_STORAGE_RECOVERY_2026-08-13.md),
   and the [storage implementation review brief](../../agents-dev-guidelines/prompts/2026-08-23_t3_codex_storage_retention_implementation_review.md).
6. For optional messaging-command implementation, the central
   [native T3 sideband standard](../../agents-dev-guidelines/standards/2026-08-13_native_t3_sideband_agent_coordination.md)
   and historical implementation on `sned/t3-reliability-upstream-880` are
   reference material, not prerequisites for current native sends.
7. For implementation only, read the relevant
   [Tasks handoff](handoffs/t3-portfolio-control-tasks-foundation-worker-2026-08-22.md)
   or [Rotations handoff](t3-portfolio-rotations-view-builder-handoff-2026-08-22.md).

The older execution and Heartbeat roadmaps remain useful evidence of completed
slices and original contract decisions. They are no longer the authority for
Mac ports/profiles, VoiceTools ownership, or the current build order.

## Document consolidation decisions

- This plan is the single current start-to-finish authority. Do not create
  another overlapping Portfolio master plan.
- The architecture decision owns durable boundaries; update it only when an
  ownership or topology decision changes.
- The lifecycle runbook owns Alpha/Dev profiles, ports, restarts, worker stop,
  and the safe storage-maintenance operating boundary.
- The messaging behaviour guide owns exact dispatch behaviour and examples;
  it may be updated later if the proven procedure is packaged as a command.
- The execution plan and Heartbeat roadmap are evidence ledgers. Keep their
  completed receipts, but do not use their old ordering to override this plan.
- The Tasks and Rotations handoffs remain focused worker entry points. They do
  not become independent architecture authorities.
- The central storage standard remains authoritative for protected-state and
  cleanup rules; this repository owns the T3 product implementation.
- The central Agents Dev Guidelines `AGENTS.md`, `CURRENT.md`, and native T3
  messaging standard require one coordinated follow-up because they currently
  disagree about whether VoiceTools is mandatory or optional for ordinary
  coordination. Do not patch only one of those files and leave a new
  contradiction.
