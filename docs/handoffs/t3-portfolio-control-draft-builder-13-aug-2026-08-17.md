# Outgoing rotation handoff — T3 Portfolio Control Draft Builder 13 Aug

Date: 2026-08-17  
Session: `T3 Portfolio Control Draft Builder 13 Aug`  
Worktree: `/Users/snedmusic/snedcodes/t3-snedcodes-dev`  
Handoff type: durable outgoing rotation context; no successor or runtime action performed

## Current goal and role

The current goal is to make the native T3 Portfolio Control useful and dependable,
with Heartbeats first, while faithfully porting the existing VoiceTools model rather
than inventing a second system. Native T3 should own ordinary projects, threads,
turns, messages, activity, token telemetry, interruption, and execution. VoiceTools
may temporarily remain the owner of Portfolio task/wishlist records, Heartbeat
lifecycle and cross-host receipts until those seams are deliberately transferred.

The active role is the T3 Portfolio/Heartbeat foundation builder and source/document
owner for this fork. It is not the VoiceTools owner, release engineer, installer
owner, or runtime operator.

## Verified repository state

These facts were checked from the worktree, not inferred from transcript text:

- Branch: `sned/t3-snedcodes-dev`, tracking `upstream/main`, ahead by 37 commits.
- HEAD: `e8f07dc74e081c54ca46440a33977a48fb19f35b` — `docs: consolidate portfolio and rotation roadmap`.
- Dirty/untracked state at handoff preparation:
  - modified: `apps/server/src/bin.ts`
  - untracked: `apps/server/src/cli/turn.ts`
- Those two files are an incomplete/uncommitted native sideband interrupt attempt.
  They are preserved, excluded from the completed-work claims below, and must not be
  overwritten or swept into this documentation commit.
- No existing durable T3 handoff file was found under `docs/`; this document adds
  one without replacing another handoff.

The old fork `/Users/snedmusic/snedcodes/t3code`, the installed official T3 app,
VoiceTools runtime state, and the user's shared `~/.t3/userdata` are outside this
worktree change.

## Completed work and exact evidence

The following are committed in this branch:

- `f99212577` — native Heartbeat target foundation. It derives up to 20 real native
  project/thread targets and puts active targets first.
- `6aac093b0` — native context rotation health and token-threshold telemetry.
- `013dd829f` — Heartbeat targets linked to native threads.
- `d99b5c54d` — paused, non-persistent Heartbeat draft configuration showing cadence,
  run limits, expiry, finish line, allowed actions, stop conditions, and receipt owner.
- `0fecdbaea` — Heartbeat stop conditions aligned with maximum runs, expiry,
  finish-line, and manual pause/stop.
- `83b6034c1` — truthful paused owner state (`Not connected`).
- `62be463e6` — actionable Help & Workflows catalog with stable IDs, inputs,
  permitted actions, stop conditions, evidence, and sources.
- `339440865` — visible Storage destination placeholder; no scan, polling, cleanup,
  database, or invented measurement.
- `09dd3862f` — deferred Heartbeat thread hydration to reduce navigation delay.
- `26feda06a` — Auto Resend recovery resets per turn.
- `10299fe57` and `db239c737` — do not interrupt active tool turns; guarded recovery
  for genuinely stale text-only turns.
- `8f9fc096f` — per-thread Auto Resend preference.
- `7ee2ce57c` — foundation progress receipt: 19 focused web tests, web typecheck,
  diff check, and web production build passed under Node 24; an isolated disposable
  web stack was started/migrated; controlled DOM preview automation did not complete.
- `e8f07dc74` — current consolidated Portfolio/rotation roadmap.

The current UI therefore has the global Agents/Portfolio navigation, native project
and thread linkage, Heartbeats-first Portfolio destinations, truthful Host Health
labels, paused Heartbeat target/configuration views, context health, workflows, and
storage placeholder. Heartbeats, Tasks, Wishlist, and VoiceTools host health are not
connected live.

## Governing plans, docs, and standards

- `AGENTS.md` — rapid source-first development, focused checks, one active T3 owner
  per real profile, no direct SQLite writes, no live shared-profile dev server, and
  no destructive/runtime actions without explicit scope.
- `docs/t3-portfolio-consolidated-roadmap-2026-08-17.md` — current combined plan,
  ownership model, achieved work, rotations design, storage/workflow direction, and
  implementation order.
- `docs/t3-portfolio-heartbeat-first-roadmap-2026-08-17.md` — phased port plan from
  the paused native foundation through owner transfer, real records, native dispatch,
  controlled proof, Tasks/Wishlist, token health, storage, workflows, and later
  Realtime Assistant integration.
- `docs/t3-voicetools-messaging-and-portfolio-foundation-consolidation-2026-08-16.md`
  — traced VoiceTools send gates, native T3 dispatch/interrupt paths, registration
  lifecycle, and the boundary between compatibility and native ownership.
- `docs/voicetools-portfolio-heartbeat-port-map-2026-08-15.md` — source evidence for
  `HeartbeatService`, `PortfolioLedger`, persisted VoiceTools state, target rules,
  lifecycle, receipts, and the delivery path T3 must eventually replace.
- `docs/portfolio-control-expansion-plan-2026-08-16.md` — workflow/help, disk
  footprint, token health, stop-turn recovery, owner seam, and real-record work order.
- Agents Dev Guidelines Plan 006/007 and
  `agent_roles/ROTATION_AUTOMATION_CONTRACT.md` — rotation authority, lifecycle,
  role/standards links, exact visible T3 identity, bounded context rules, receipts,
  idempotency, and the prohibition on automatic cutover.

## Decisions and rejected approaches

- Preserve one native T3 project/thread/session identity. Do not create a second
  registry, duplicate session database, broker, poller, or permanent agent service.
- Keep Heartbeats paused and read-only until the owner seam, real records/readback,
  native dispatch, and one bounded disabled proof exist.
- Port VoiceTools Heartbeat rules and receipts faithfully, but replace only its
  delivery mechanism with a normal native T3 `thread.turn.start` against the exact
  `environmentId + threadId`.
- Use the existing native T3 interrupt chain (`thread.turn.interrupt`) for stopping;
  do not add a competing red stop control. Auto Resend may stop/resend only a stale
  text-only turn with no newer tool or approval activity; tool activity means no
  automatic stop/resend and requires review.
- Rotations is a future Portfolio destination separate from Agents. The first
  Rotations slice should be read-only and derive from native thread/context data.
  One-click rotation must preview a versioned standards-linked prompt before any
  future dispatch; it must not imply cutover or authority transfer.
- Do not rebuild the existing VoiceTools Realtime Assistant now. It is a later
  integration target, not a new assistant design.
- Do not use browser automation for the Electron workflow unless explicitly requested;
  do not run two T3 owners against the same real profile.

## Known regressions, limitations, and missing context

- The sideband interrupt command is currently uncommitted and not yet proven. The
  native in-app stop path is the verified architectural reference; the CLI wrapper
  still needs focused validation.
- The 17 August evidence records a controlled preview that could not complete DOM
  snapshot/click automation. This is incomplete smoke evidence, not proof that the
  UI is broken.
- User transcript reports included slow reload/navigation, Agents loading delays,
  provider/backend readiness failures, and a right-pane theme mismatch. These are
  context only; no repository command in this handoff proves their current runtime
  cause.
- VoiceTools target resolution, exact live owner state, bounded transcript readback,
  and cross-host receipt authority remain unresolved for the native port.
- The current native UI does not yet measure real disk usage, persist Portfolio
  records, run Heartbeats, activate scheduling, or provide automatic rotations.
- Plan/source evidence reports large possible T3 storage areas, but no current live
  disk measurement was taken here. Do not present that estimate as a runtime fact.
- The exact latest VoiceTools compatibility state and the final supported source
  launch command still require source/runtime verification in their own tranche.

## Tests and implementation evidence

Verified evidence currently available in committed docs and git history:

- 19 focused web tests passed.
- Web typecheck passed.
- `git diff --check` passed.
- Web production build passed under the installed Node 24 toolchain, with normal
  large-chunk/plugin warnings recorded in the progress receipt.
- An isolated disposable web stack was started and migrated without using the shared
  live profile. A complete interactive DOM smoke proof is still missing.

The dirty sideband files have not been included in those claims. Transcript claims
about messages, provider readiness, stop banners, or live sessions are not filesystem
or runtime proof and must be rechecked through supported T3 surfaces before relying
on them.

## Protected boundaries

Until explicitly changed by a future, scoped request:

- Do not create, rename, retire, archive, cut over, or mutate a successor session.
- Do not activate Heartbeats, add a scheduler/poller, call VoiceTools from the native
  source slice, or send an external message.
- Do not write T3 SQLite directly or start a dev server against
  `/Users/snedmusic/.t3/userdata`; use a disposable worktree profile for tests.
- Do not expose or change credentials, pairing tokens, provider accounts, or host
  ownership.
- Do not package, install, replace the official app, deploy, publish, or change a
  live runtime as part of this lane.
- Preserve the existing `apps/server/src/bin.ts` modification and untracked
  `apps/server/src/cli/turn.ts`; do not use destructive cleanup commands.

## Unfinished work

The major unfinished areas are: native sideband interrupt proof; read-only Rotations
status and standards-linked prompt preview; the transferable VoiceTools owner seam;
real paused Heartbeat readback; native delivery replacement and one disabled proof;
Tasks/Wishlist authority; token alerts and bounded transcript context; disk inventory
and dry-run cleanup preview; file-backed workflows; Projects/Documents/Trajectory/
Rants; and later integration of the already-existing VoiceTools Realtime Assistant.

## Exactly three ordered successor actions

1. Finish and validate the existing native sideband interrupt command in
   `apps/server/src/cli/turn.ts` and `apps/server/src/bin.ts`. Use the typed native
   orchestration contract, add focused tests for accepted/stopped/delayed/failed/
   uncertain outcomes, and commit only those owned source files after the dirty diff
   is understood. Do not send to a real session.
2. Add the read-only Portfolio **Rotations** destination and pure status model. Derive
   it from real native project/thread shells and existing context telemetry; show
   token/size status, rotation-needed reasoning, role/standards links, and a bounded
   prompt preview. Do not create a registry, dispatch a worker, persist duplicate
   identity, or perform cutover.
3. Implement the VoiceTools owner seam as a truthful disabled/read-only descriptor,
   then connect a real paused Heartbeat read surface only after its owner, target,
   lifecycle, and receipt evidence are available. Preserve VoiceTools as temporary
   owner, keep Heartbeats paused, and leave native T3 delivery activation for the
   separately evidenced dispatch-proof slice.

This handoff is context for the next owner. It grants no runtime, credential,
publication, deletion, external-send, or session-management authority.
