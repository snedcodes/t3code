# Portfolio Control Draft Workspace

## Outcome

Create a usable draft Portfolio Control area in T3 that adopts the existing
VoiceTools GUI's information architecture without creating a second operational
ledger or pretending unfinished features work.

## Source authority

- Live product reference: `http://127.0.0.1:8507/portfolio-control`.
- VoiceTools Plan 543: Task, Wishlist, Agents, Heartbeats, Host Health.
- VoiceTools Plan 544: later Projects, Documents, Trajectory, Rants.
- VoiceTools Plan 561: portfolio/heartbeat state has no single cross-host owner
  yet; no T3 feature may silently duplicate it.
- VoiceTools Plan 564: T3 becomes the main shell over time; Rants and Assistant
  work follow the state-owner repair.

## First draft surface

Add a top-level native T3 Portfolio Control entry with these destinations:

1. Tasks — clearly labelled as VoiceTools-authoritative until owner-routed data
   is available; no create/edit/checklist controls in this tranche.
2. Wishlist — same authority label; no local promotion or persistence.
3. Agents — reuse existing native T3 project/thread/session state where
   available; group and link into normal T3 threads rather than duplicating
   identity.
4. Heartbeats — honest unavailable/paused source state only; never an activate,
   pause, resume, or run-now control.
5. Host Health — native T3 host/environment information where available, with
   an honest unavailable state for VoiceTools-only health data.
6. Projects, Documents, Trajectory, Rants — visible draft destinations, each
   explaining its future purpose from Plan 544 and containing no invented data.

## Design rules

- Borrow the practical, scannable navigation language of the live GUI.
- Use native T3 routes and live thread state for agent navigation.
- Keep the page read-only except normal T3 thread navigation.
- No VoiceTools API client, proxy, polling loop, server endpoint, database,
  cache, Passport registry, Heartbeat scheduler, or Realtime Assistant feature.
- Do not call a project card a task or derive a project registry from titles.

## Implementation sequence

1. Inspect the live page and its served JavaScript plus Plans 543, 544, 561,
   and 564.
2. Add pure view-model derivation for native T3 Agent data and focused tests.
3. Add the route and both sidebar entry points using established T3 patterns.
4. Build the destination layout and truthful authority/draft states.
5. Run focused checks and one isolated authenticated web verification. Confirm
   native thread links work and the page makes no background polling requests.

## Acceptance

- The page gives the user one recognisable Portfolio Control home in T3.
- Agents link to real native threads.
- Every non-migrated VoiceTools capability is visibly labelled, not faked.
- No data store, mutation control, or VoiceTools runtime dependency is added.

## Handoff

Commit only owned T3 web files. Report the route, files, focused validation,
integrated web proof, and the exact data/controls deliberately deferred to the
Portfolio owner-repair tranche.

## Tranche receipt — 13 August 2026

Added the normal T3 Portfolio Control navigation entry through the shared
sidebar chrome, covering both sidebar variants, with active-route styling.
The route remains read-only and native-state-only; VoiceTools authority,
Heartbeats, storage, polling, and mutation controls remain deferred.

## Tranche receipt — 15 August 2026

Added native environment context to Host Health and a pure, paused-by-default
Heartbeat foundation. The model targets only an existing scoped native T3
thread reference, permits one normal T3 turn, names cadence, run limit,
expiry, finish line, allowed action, stop conditions, and native receipt owner,
and stores no duplicate session identity. No scheduler, persistence, polling,
dispatch, VoiceTools migration, or runtime action was added.

## Tranche receipt — 15 August 2026

Added a read-only native target selector to the paused Heartbeat foundation.
Options derive from current non-archived, non-settled native T3 thread shells,
ordered by native update time and labelled with project/environment context.
The selected value is local component state only; it stores only the scoped
native thread reference and cannot activate or dispatch a Heartbeat. Focused
model tests pass. The isolated dev stack starts under Node 22.23.2 and reaches
the pairing stage, but the attached preview could not reach the shell-launched
loopback port, so authenticated browser smoke remains the next verification
boundary.
