# T3 Portfolio Rotations View Builder — Handoff

Date: 22 August 2026  
Track: `T3 Portfolio Rotations View Builder 17 AUG`  
Repository: `/Users/snedmusic/snedcodes/t3-snedcodes-dev`  
Status: read-only Rotations foundation complete; visible-client review and
future action preparation remain

## 1. What this work is

Portfolio Control is being built as a cross-environment control surface over
native T3 data. Native T3 remains authoritative for projects, threads,
provider sessions, turns, token/context telemetry, environment identity, and
receipts. Portfolio must not become a second project/thread database, session
registry, scheduler, message bus, or owner of agent lifecycle state.

The Rotations destination is the read-only triage view. It answers:

- Which native worker/thread is being inspected?
- Which project and environment does it belong to?
- How fresh and large is the available context/token telemetry?
- Does the observed native telemetry indicate healthy, watch, required, or
  unavailable rotation status?
- Which role, standards links, and bounded prompt preview are explicitly
  available?
- What later action would need review, without enabling that action now?

The intended later direction is a safe handoff/rotation proposal routed to an
explicit native target with a typed receipt. This thread deliberately stopped
before Rotate, successor creation, rename, archive, handoff execution, or
cutover.

## 2. Work completed in this thread

### Read-only Rotations row model

`apps/web/src/portfolioRotation.ts` and its focused test implement the first
read-only row model.

The row carries scoped native identity:

```text
environmentId + projectId + threadId
```

It also carries session/project/environment labels, workspace, platform,
server version, connection phase, native timestamps, provider/worker name,
session status, context/token telemetry, telemetry freshness, rotation state
and reason, role/standards metadata, and the bounded prompt preview.

The builder:

- derives rows from native project and thread shells;
- excludes archived threads;
- uses native timestamps for creation and latest activity;
- uses real hydrated telemetry when supplied;
- marks missing telemetry as `Unavailable` rather than estimating a rotation
  need;
- distinguishes `Healthy`, `Watch`, `Rotation required`, and `Unavailable`;
- keeps missing role and standards data as `null`/empty;
- uses prompt preview version `rotation-prompt-v1`; and
- bounds the preview to 1,200 characters.

### Ordering and grouping

The read-only view supports deterministic presentation ordering:

- Attention;
- Last used;
- Newest;
- Oldest;
- Processed tokens;
- Context used;
- Project; and
- Host/environment.

It supports presentation-only grouping by none, project, or host/environment.
Rows retain their environment/project/thread identity. Missing numeric values
sort after known values, and stable text/key tie-breakers prevent list
movement when values are equal.

The ordering rationale and non-goals are recorded in
`docs/t3-portfolio-rotations-ordering-plan-2026-08-17.md`.

### Web Rotations presentation

`apps/web/src/components/PortfolioModeNavigation.tsx` renders the Rotations
surface and its compact sort/group controls. The detail area displays status,
reason, native identity context, telemetry availability, worker/role metadata,
standards links when present, and the versioned prompt preview.

The component also contains a separate ordinary native-message proof and an
“Open native thread” path. That message proof is not a Rotate action and must
not be described as rotation execution or successor creation.

### Pure authority resolver

`apps/web/src/portfolioRotationAuthority.ts` and
`apps/web/src/portfolioRotationAuthority.test.ts` consume an existing
`PortfolioRotationRow` and return:

- deterministic worker identity with environment/project/thread IDs;
- worker value without inventing one when absent;
- role value plus explicit availability;
- standards links exactly as supplied;
- the row’s prompt preview version; and
- a typed read-only action policy.

The policy explicitly keeps all of these disabled:

```text
rotate
createSuccessor
rename
archive
handoff
cutover
```

The resolver is pure and has no transport, persistence, scheduler, dispatch,
owner mutation, VoiceTools, or live-state behavior.

### Shared owner-readback support and mobile cross-surface wiring

Earlier bounded slices in this thread added/validated the shared read-only
owner-readback path used by the Portfolio surfaces:

- `packages/client-runtime/src/state/portfolioHeartbeatOwnerHttp.ts`
- `packages/client-runtime/src/state/portfolioHeartbeatOwnerHttp.test.ts`
- `packages/client-runtime/src/state/portfolio.ts`
- `apps/web/src/connection/runtime.ts`
- `apps/web/src/state/portfolio.ts`
- `apps/mobile/src/connection/runtime.ts`
- `apps/mobile/src/state/portfolio.ts`

Mobile uses the existing connection catalog, supervisor, auth, and client
runtime loader. It does not create another registry or storage path.
The mobile target projection and focused tests are in:

- `apps/mobile/src/state/portfolioTargets.ts`
- `apps/mobile/src/state/portfolioTargets.test.ts`

This is supporting readback/identity infrastructure, not a Rotation transport
or a live owner-transfer mechanism.

## 3. Why the broader Portfolio work exists

The broader Portfolio Control effort is moving operational coordination into
native T3 boundaries while preserving multi-machine identity. Mac, Windows,
VPS, and mobile environments may have different local T3 homes and mixed
versions, so a project ID or thread ID is not globally meaningful by itself.
Every future read or action must retain the environment ID alongside native
project/thread identity.

The Heartbeat/owner work establishes a separate owner and receipt contract for
future bounded execution. Rotations depends on those contracts only for later
action design; it must not create an owner, start a scheduler, or bypass the
native turn path while those contracts are being proven.

VoiceTools is a temporary compatibility/read-import source in the migration
plan, not the native T3 messaging transport. The Rotations work adds no
VoiceTools call or send gate.

## 4. Relevant documents referenced

Read these before continuing the track:

- `AGENTS.md` — live repository rules, scope boundaries, validation guidance,
  multi-surface expectations, and worktree safety.
- `docs/t3-portfolio-control-execution-plan-2026-08-19.md` — active work order,
  delegated worker map, Slice 1 and Slice 7 receipts, current coordinator
  actions, and explicit Rotations non-goals.
- `docs/t3-portfolio-control-architecture-decision-2026-08-19.md` — native T3
  authority, environment identity, connection boundary, Heartbeat boundary,
  Rotations boundary, and prohibited duplicate systems.
- `docs/t3-portfolio-control-current-work-index-2026-08-17.md` — ownership and
  current-work coordination index.
- `docs/t3-portfolio-consolidated-roadmap-2026-08-17.md` — strategic Portfolio
  sequencing and relationship between Rotations, Heartbeat, Tasks, and
  migration work.
- `docs/t3-portfolio-heartbeat-first-roadmap-2026-08-17.md` — why Heartbeat
  owner/receipt proof precedes any live recurring action.
- `docs/t3-portfolio-rotations-ordering-plan-2026-08-17.md` — implemented
  ordering/grouping behavior, data boundary, and ordering non-goals.
- `docs/t3-portfolio-control-t3-lifecycle-and-messaging-runbook-2026-08-22.md`
  — current lifecycle/messaging operational context; use it for coordination,
  not as permission to expand the Rotation scope.

Useful source references:

- `packages/client-runtime/src/state/portfolio.ts` — shared environment-scoped
  owner query atom factory.
- `packages/client-runtime/src/state/portfolioHeartbeatOwnerHttp.ts` — shared
  authenticated owner read loader.
- `apps/web/src/portfolioHeartbeatOwner.ts` — existing owner-readback
  normalization and unavailable-value behavior.
- `apps/web/src/portfolioHeartbeatOwnerTransferPreview.ts` — separate
  read-only owner-transfer preview; do not confuse it with Rotation authority.
- `packages/contracts/src/portfolio.ts` — typed owner/receipt vocabulary used
  by adjacent Heartbeat work.

## 5. Current validation receipt

Focused Rotations validation most recently run:

```text
vp test run apps/web/src/portfolioRotation.test.ts \
  apps/web/src/portfolioRotationAuthority.test.ts
  -> 2 test files passed, 8 tests passed

vp run --filter @t3tools/web typecheck
  -> passed

vp fmt --check \
  apps/web/src/portfolioRotation.ts \
  apps/web/src/portfolioRotation.test.ts \
  apps/web/src/portfolioRotationAuthority.ts \
  apps/web/src/portfolioRotationAuthority.test.ts
  -> passed

git diff --check -- <Rotation files>
  -> passed
```

The broader Rotations format check also included the already-dirty
`PortfolioModeNavigation.tsx` and reported formatting drift in that file. It
was not reformatted during the final audit because the request was a handoff,
and unrelated/pre-existing work must be preserved. The new pure model and its
test are formatted cleanly.

No browser automation, dev server, mobile simulator, VoiceTools call, live
dispatch, owner claim, scheduler, or runtime-state write was performed for the
final handoff audit.

## 6. Where the work stands

### Complete

- Native row identity is environment-aware.
- Rotation status derives only from supplied native telemetry.
- Telemetry freshness and missing-value behavior are explicit.
- Sorting and grouping are deterministic and view-local.
- Prompt preview is bounded and versioned.
- Role/standards metadata is preserved when supplied and remains unavailable
  when not supplied.
- Pure authority resolution exists with a fully disabled action policy.
- Focused web tests and web typecheck pass.
- Shared web/mobile owner readback uses the existing connection runtime.

### Incomplete or intentionally deferred

- A real-client/Electron review of populated Rotations rows remains pending.
  The previous controlled preview encountered an empty sidebar while the shell
  snapshot request was slow. Do not treat that as proof that no native rows
  exist.
- The current row builder sets `role: null` and `standards: []` because no
  existing native source was established for those fields. A future adapter
  may populate them only from explicit native data; it must not infer them from
  provider names, prompts, paths, or telemetry.
- There is no Rotate action, successor creation, rename, archive, handoff
  execution, cutover, or lifecycle mutation.
- There is no Rotation-specific persisted state, scheduler, poller, duplicate
  registry, or Portfolio database.
- Full fleet-wide telemetry ordering remains bounded by the existing selected
  thread/detail hydration path; do not add an N-per-row fetch loop or poller.
- The ordinary native-message proof in the UI is separate from Rotation and
  does not constitute a rotation handoff or successor action.

The active execution plan assigns the Rotation worker Slices 1 and 7 only.
Coordinator-owned Heartbeat/owner work, VPS receipts, scheduler work, Task
discovery, and VoiceTools retirement are not Rotation tasks.

## 7. Exact next safe Rotation slice

Implement one pure, read-only bounded handoff-preview model in new
`apps/web` files only. It should consume `PortfolioRotationAuthority` and
return:

- the unchanged scoped worker identity;
- the available/unavailable role and standards metadata;
- the versioned prompt-preview identity;
- a bounded human-review proposal describing why a handoff may be considered;
- explicit missing-evidence fields rather than inferred values; and
- the existing all-disabled action policy.

Add focused tests for complete metadata, unavailable metadata, deterministic
output, bounded preview/proposal text, and disabled actions. Do not add a
button handler, dispatch call, successor creation, owner lookup, scheduler,
server route, contract, transport, VoiceTools integration, persistence, or
cutover logic.

After that pure slice, the only justified UI work is a read-only display of
the model in the existing Rotations detail view. Any actual Rotate/handoff
design must wait for the coordinator’s proven owner and receipt contracts and
must use an explicit native target plus idempotency/receipt semantics.

## 8. Safe continuation checklist

Before editing:

1. Read the live `AGENTS.md` and this handoff.
2. Inspect `git status --short`; preserve all existing dirty changes.
3. Read the active execution plan and the Rotation source/tests.
4. Keep edits under `apps/web/src/portfolioRotation*` unless a narrowly
   requested read-only detail integration is required.
5. Do not touch Heartbeat owner/scheduler/transfer files, Tasks, VoiceTools,
   environment transport, server routes, contracts, or runtime state.

After editing:

1. Run only focused Rotation tests.
2. Run `vp run --filter @t3tools/web typecheck`.
3. Run formatting and `git diff --check` on owned files.
4. Do not launch a dev server or browser unless explicitly requested.
5. Return files, proof, limitations, exact next slice, and whether a commit was
   made. Do not commit unless explicitly requested.

## 9. Worktree safety note

At handoff time the worktree contains substantial unrelated dirty changes
across server, mobile, contracts, client-runtime, docs, and Heartbeat/owner
paths. They belong to other coordinator or worker slices. This handoff adds
only this documentation file; the next agent must not reset, clean, stash, or
format the whole worktree as part of Rotation work.
