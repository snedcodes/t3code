# T3 Portfolio Tasks Foundation — worker handoff

Date: 22 August 2026  
Worker: `T3 Portfolio Tasks Foundation Builder 21 AUG`  
Project: `T3 Code Reliability Dev`  
Coordinator: T3 Portfolio Control coordinator  
Status: contract foundation implemented; runtime Tasks/Wishlist integration not started

## 23 August reconciliation

The contract receipt remains current. The read-only-only next slice proposed
near the end of this handoff is superseded by the
[consolidation plan](../t3-native-messaging-portfolio-consolidation-plan-2026-08-23.md):
the next Tasks work should be one small owner-backed persistence/API/web/mobile
vertical slice after native messaging and Storage Health foundations. Task
records must not duplicate context telemetry, transcript storage, retention
candidates, or storage cleanup state.

## Executive summary

This thread covered the discovery and first contract-only implementation slice
for Portfolio Control Tasks and Wishlist records in T3 Code.

The intended product is a single Portfolio Control view across the Mac,
Windows laptop, Windows VPS, and mobile client. T3 is the execution authority:
it owns environments, projects, threads, native turns, provider execution, and
native receipts. The selected Windows VPS T3 environment is intended to own the
canonical Portfolio/Heartbeat state. Mac and mobile should read that state
through T3's existing environment catalog and authenticated connection runtime.

The Task foundation deliberately stops before persistence, server endpoints,
client loaders, UI, scheduling, dispatch, migration writes, or automation. No
T3 process restart or GUI restart was initiated in this thread.

## Why this work exists

Portfolio Control must provide a useful cross-machine task view without creating
another project/thread registry, message bus, database, scheduler, or VoiceTools
transport. A Task must point to one exact native T3 destination:

```text
{ environmentId, projectId, threadId }
```

That identity is not globally replaceable by a project ID, host label, Passport
ID, title, or VoiceTools session key. Task lifecycle (`in_progress`, `blocked`,
`complete`, etc.) must also remain separate from native delivery evidence
(`accepted`, `dispatched`, `transcript-confirmed`, `uncertain`, etc.). This
prevents a Task from being presented as complete merely because a turn was
accepted, or from being presented as failed merely because readback is delayed.

The broader effort is migrating Portfolio/Heartbeat authority toward native
T3 while keeping existing VoiceTools records available as temporary
read/import compatibility evidence. Heartbeats remain paused and scheduling
remains disabled.

## Context and authority already established

The coordinator's handoff authorized this slice after the Windows VPS source
Dev Heartbeat owner seam was proven. The reported proof was:

- fresh owner descriptor at epoch 0;
- one exact native `thread.turn.start` accepted by the target environment;
- target-thread completion/readback; and
- persisted `transcript-confirmed` receipt.

The connectivity handoff recorded this dated 22 August topology:

- Mac source Dev was then using the live Mac profile on port 3773. That is
  historical evidence, not the current operating instruction. Alpha now owns
  the live profile and port 3773; any Mac Dev client must use an isolated home
  and port 3774;
- Windows VPS source Dev: `C:\Users\Administrator\src\t3-snedcodes-dev-git`,
  source Dev profile, port 3774, Task Scheduler-owned; and
- Windows laptop source Dev: separate source Dev profile and lifecycle owner.

Those runtime facts are context only. This worker did not access, modify, or
restart any of those profiles.

## Documents and source references used

Repository documents:

- [Current consolidation plan](../t3-native-messaging-portfolio-consolidation-plan-2026-08-23.md)
  — current build order, native messaging authority, VoiceTools retirement,
  and Tasks/Storage sequencing.
- [Execution receipt ledger](../t3-portfolio-control-execution-plan-2026-08-19.md)
  — dated delegated Tasks scope and implementation receipts; it is not the
  current ordering authority.
- [Architecture decision](../t3-portfolio-control-architecture-decision-2026-08-19.md)
  — T3 ownership, exact environment/project/thread identity, native dispatch,
  and VoiceTools migration boundary.
- [Multi-computer connectivity handoff](t3-portfolio-control-multi-computer-connectivity-handoff-2026-08-21.md)
  — verified Mac/VPS/laptop topology and native T3 connectivity rules.
- [Existing Tasks worker handoff](t3-portfolio-control-tasks-foundation-worker-2026-08-21.md)
  — the explicit implementation authorization and boundaries for this slice.
- [VoiceTools Portfolio/Heartbeat port map](../voicetools-portfolio-heartbeat-port-map-2026-08-15.md)
  — legacy Task/Wishlist fields, ledger authority, and the reason exact native
  T3 identity must replace ambiguous VoiceTools routing.
- [VoiceTools messaging and Portfolio foundation consolidation](../t3-voicetools-messaging-and-portfolio-foundation-consolidation-2026-08-16.md)
  — migration sequencing and no-second-ledger/no-VoiceTools-send-path rules.

Legacy source inspected read-only:

- `/Users/snedmusic/snedcodes/VoiceToolsSuite-heartbeat-v2/voicetools/voicetools/api/portfolio_task_contract.py`
  — `PortfolioLedger`, Task fields, status sets, checklist states, document
  links, progress receipts, revisions, and `heartbeat_target_ref`.
- The legacy Task status set was:
  `draft | ready | in_progress | blocked | complete | cancelled`.
- The legacy Wishlist status set was:
  `idea | clarifying | designing | ready | promoted | implemented | declined`.
- The legacy checklist state set was:
  `open | in_progress | blocked | complete`.

## Implementation performed

Only these two source files were changed by this worker:

- [`packages/contracts/src/portfolio.ts`](../../packages/contracts/src/portfolio.ts)
- [`packages/contracts/src/portfolio.test.ts`](../../packages/contracts/src/portfolio.test.ts)

The existing `packages/contracts/src/index.ts` already exports
`./portfolio.ts`; no export-file change was needed.

### Canonical target and Task contracts

`PortfolioTarget` remains the shared branded target containing
`EnvironmentId`, `ProjectId`, and `ThreadId`.

The new `PortfolioTask` contract contains:

- branded `RuntimeTaskId`;
- required trimmed `title` and `outcome`;
- required exact `target`;
- Task-only status;
- trimmed priority;
- nullable Passport/host assignment metadata;
- checklist items with stable IDs, state, evidence, updater, and timestamp;
- completion condition;
- plan and evidence document links;
- created/updated/completed timestamps;
- positive monotonic revision;
- nullable `lastReceipt`; and
- nullable `heartbeatId` binding.

`PortfolioWishlist` contains the smallest review/promotion shape:

- wishlist ID;
- title and summary;
- Wishlist status;
- priority;
- document links;
- created/updated timestamps;
- positive revision; and
- nullable promoted `RuntimeTaskId`.

Wishlist does not require a native target because it is an idea/review record,
not an assigned executable Task. Promotion must later resolve an exact native
target before producing a canonical Task.

### Receipt separation

Tasks reuse the existing `PortfolioHeartbeatReceipt` structure for native
evidence. It carries command ID, exact target, native receipt status, optional
sequence, observed time, and detail.

The Task status union is intentionally separate from the receipt union. The
tests explicitly reject `transcript-confirmed` as a Task status.

### Legacy compatibility resolution

`resolvePortfolioTaskLegacyTarget` is a pure target-resolution helper. It accepts
explicit legacy camelCase or snake_case target fields, including a nested
`target`, and returns either:

- `resolved: true` with the exact branded target; or
- `resolved: false` with
  `missing_or_ambiguous_native_target`.

It does not infer environment, project, or thread IDs from project-only data,
host names, Passport values, labels, or VoiceTools records. A partial nested
target or conflicting nested/top-level target remains unresolved and therefore
read-only for migration purposes.

`isPortfolioTaskRevisionAdvance` provides the pure rule that a valid revision
must be a safe integer at least 1 and strictly greater than the current
revision. It does not persist or mutate anything.

## Validation performed

The focused command run before the final compatibility-hardening edit was:

```text
vp test run packages/contracts/src/portfolio.test.ts
```

Result at that point:

- 1 test file passed;
- 11 tests passed.

The contracts package typecheck also completed successfully:

```text
vp run --filter @t3tools/contracts typecheck
```

After that validation, one additional test case and the corresponding partial
nested-target guard were added. The final 12-test state was not re-run because
the user instructed the worker to cease immediately. The next agent should run
the focused test and typecheck before relying on this slice.

`git diff --check` passed for the two changed source files before the final
compatibility-hardening edit. No repository-wide checks were run.

## Explicit non-actions and boundaries honoured

This worker did not add or change:

- a second database or direct SQLite writes;
- server persistence or migration code;
- Portfolio HTTP endpoints;
- client-runtime loaders;
- web or mobile UI;
- Heartbeat owner code or owner transfer;
- scheduler behavior;
- native transport or turn dispatch;
- VoiceTools messaging or send gates;
- automatic claiming, retry, completion, or task execution; or
- any T3 process, GUI, profile, or runtime state.

The worktree was already dirty with unrelated Portfolio and T3 changes before
this worker's implementation. Preserve those changes; do not reset or clean
the worktree while continuing.

## Current state

Completed:

- contract-level Task and Wishlist vocabulary exists;
- Task IDs are branded with the existing `RuntimeTaskId` brand;
- canonical Tasks require exact native target identity;
- Task lifecycle is distinct from native receipt lifecycle;
- checklist, completion, links, assignment, priority, timestamps, revision,
  nullable receipt, and optional Heartbeat binding are represented;
- explicit legacy target resolution is fail-closed; and
- focused tests cover valid shapes, missing targets, ambiguous targets,
  revisions, and status separation.

Not complete:

- no canonical owner-backed Task/Wishlist persistence exists yet;
- no read-only owner endpoint or `TasksReadback` wrapper exists;
- no VPS-owned revision/checksum integration exists for Tasks;
- no Mac/mobile environment-supervisor query exists;
- no migration reader has been connected to the VoiceTools ledger;
- no legacy Task field-by-field import projection exists beyond target
  resolution;
- no Task receipt persistence/readback exists;
- no Task/Wishlist UI exists; and
- no Task dispatch, scheduler, claiming, retry, or completion automation is
  authorized in this tranche.

## Design choices requiring awareness

1. `PortfolioTask.priority` is a non-empty string rather than a new fixed
   priority enum. This preserves legacy priority values without expanding the
   current contract unnecessarily.
2. Task assignment retains legacy `ownerPassportId` and `ownerHost` as
   nullable metadata, but neither is authoritative for native execution. The
   required `target` is authoritative.
3. `heartbeatId` is only an optional binding reference. It does not activate a
   Heartbeat, schedule work, or imply that the Task is complete.
4. The existing Heartbeat receipt schema is reused rather than creating a
   second receipt vocabulary. A null `lastReceipt` means no native receipt is
   available; it must not be displayed as success.
5. Wishlist records do not require a target until promotion into a Task. Any
   future promotion path must fail closed if it cannot resolve the exact native
   target.

## Current next Tasks vertical slice

First re-run the focused 12-test contract file and contracts typecheck. Then
build one useful owner-backed vertical slice on the selected VPS environment:

1. Persist canonical Task/Wishlist records in T3's existing owner-controlled
   state path; do not create a second ledger.
2. Add owner-scoped list/detail contracts and server handlers with explicit
   revision, freshness, and unresolved-import state.
3. Load the records through the existing `EnvironmentSupervisor` and render
   the same small list on web and mobile.
4. Prove one bounded create/edit/status transition and read it back from the
   owner. Keep native delivery receipts distinct from Task lifecycle state.

Do not use VoiceTools as transport or dual-write to its ledger. Selected
legacy records may be imported later through an explicit, one-time,
fail-closed projection after VoiceTools messaging is paused.
