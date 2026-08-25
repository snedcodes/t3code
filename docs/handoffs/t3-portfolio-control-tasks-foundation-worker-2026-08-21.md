# Tasks foundation worker handoff — 21 August 2026

Target worker: `T3 Portfolio Tasks Foundation Builder 21 AUG`
Project: `T3 Code Reliability Dev`
Coordinator: T3 Portfolio Control coordinator

## 24 August status

This authorization was completed by the 22 August Tasks foundation worker and
is retained as a dated work order. Do not execute it again. Continue from the
[completed worker handoff](t3-portfolio-control-tasks-foundation-worker-2026-08-22.md)
and the
[current consolidation plan](../t3-native-messaging-portfolio-consolidation-plan-2026-08-23.md).

## Authorization and context

The native T3 Heartbeat owner seam is now proven on the Windows VPS source Dev
environment. The owner descriptor is fresh at epoch 0, and one exact native
`thread.turn.start` was accepted, completed, read back from the target thread,
and persisted as `transcript-confirmed`. Scheduling is still disabled.

Read and follow:

- [execution receipt ledger](../t3-portfolio-control-execution-plan-2026-08-19.md)
- [architecture decision](../t3-portfolio-control-architecture-decision-2026-08-19.md)
- [multi-computer connectivity handoff](t3-portfolio-control-multi-computer-connectivity-handoff-2026-08-21.md)

## Worker slice

Implement only the first narrow Tasks/Wishlist foundation slice proposed in the
existing discovery receipt:

- branded `taskId` and the smallest Task/Wishlist contract shapes;
- title/outcome and exact native target identity;
- task status distinct from native delivery/Heartbeat receipt status;
- priority/assignment, checklist items, completion condition, links, timestamps,
  monotonic revision, nullable native receipt, and optional Heartbeat binding;
- pure compatibility/validation tests for the schema and legacy mapping shape.

Keep unresolved legacy records read-only when they lack an unambiguous
`{environmentId, projectId, threadId}`. Do not infer IDs.

## Boundaries

Do not change or add:

- a second database or direct SQLite writes;
- server persistence, migration, scheduler, or Heartbeat-owner code;
- native transport or VoiceTools messaging;
- Portfolio UI or mobile UI in this slice;
- automatic task claiming, dispatch, retry, or completion automation;
- T3 process restart, rebuild, or profile changes.

Use the current source worktree and focused tests only. Do not run repo-wide
checks. Return a compact receipt with changed files, focused test command/results,
any unresolved design choice, and exactly one proposed next vertical slice.
