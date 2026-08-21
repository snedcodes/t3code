# T3 Portfolio Rotations ordering plan

Date: 17 August 2026  
Status: implemented 17 August 2026

## Goal

Make the read-only Portfolio Rotations view useful for triage without creating
Portfolio storage, polling, a scheduler, a duplicate session registry, native
dispatch, or agent lifecycle mutations.

## User-facing design

Rotations gets two compact controls above the native thread rows:

- `Sort`: the ordering applied to the flat row set;
- `Group`: optional project or host/environment sections.

The default is `Attention`, because Rotations is an operational health view.
Selections are view-local presentation state for this first slice; they are not
persisted settings.

### Sort options

1. Attention — rotation-required rows first, then watch, unavailable, and
   healthy. Ties use most recent native activity.
2. Last used — newest native activity first.
3. Newest — newest native thread creation first.
4. Oldest — oldest native thread creation first.
5. Processed tokens — highest real `totalProcessedTokens` first; missing
   telemetry sorts last.
6. Context used — highest real current context usage first; missing telemetry
   sorts last.
7. Project — alphabetical project title.
8. Host/environment — alphabetical environment label.

All comparisons have deterministic title/project/host/id tie-breakers so the
list does not jump when values are equal or unavailable.

### Group options

- None — one flat list;
- Project — one section per native project;
- Host/environment — one section per native environment.

Grouping is presentation-only and does not alter native project/thread
identity.

## Data boundary

The model uses native thread-shell timestamps for last-used/newest/oldest and
real hydrated context telemetry for token/context ordering. A row without
telemetry remains visible and is placed after rows with real values for size
sorts. No size is estimated from transcript text.

The first UI slice hydrates the currently selected native thread using the
existing detail path. Full fleet-wide token ordering can be added later when a
bounded native telemetry projection is available; this slice must not add a
poller or N-per-row detail fetch.

## Implementation order

1. Add pure sort/group types and functions beside the existing rotation model.
2. Extend the row model with native creation/last-used timestamps.
3. Add focused tests for every ordering family, missing telemetry, ties,
   archived exclusion, and grouping.
4. Add the compact Select controls to the Rotations view and render grouped
   sections when selected.
5. Run focused web tests, web typecheck, formatting, and diff checks.

## Explicit non-goals

- no Rotate action or native dispatch;
- no persistence for sort/group preferences;
- no scheduler, polling, VoiceTools request, or Portfolio database;
- no role/standards authority resolver in this slice;
- no automatic agent creation, rename, archive, successor, or cutover.

## Next safe slice after this plan

Add a read-only authoritative role/standards resolver to populate the existing
preview fields, while keeping rotation dispatch disabled until the owner and
receipt contracts are proven.
