# Portfolio Session Retention and Storage Health

## Outcome

T3 Portfolio Control makes growing session-storage risk visible before disk
space becomes critical, alongside the existing total-processed-token rotation
warning policy. It provides a safe lifecycle: active → durable handoff →
archived → explicitly deleted. It does not automatically delete a thread,
transcript, archive, cache, worktree, or database.

## Starting evidence

The current Mac evidence reports roughly 17.9 GB in 381 Codex transcript
session files, about 16 GB free disk space, and several large non-transcript
stores: approximately 11 GB in `~/t3-archives`, roughly 1.2 GB in Codex logs,
and roughly 2 GB in T3 application cache/partition/IndexedDB data. These are
separate categories and must not be reported as one undifferentiated “session
size.” The largest session groups currently include AV Transform, VoiceTools,
and VolGrid. The inventory is evidence for review, not deletion authority.

## Sources and categories

Per visible T3 thread, measure only when attribution is known:

| Measure | Meaning | Collection rule |
| --- | --- | --- |
| `total_processed_tokens` | native T3/Codex cumulative processing | Reuse native token-usage event/snapshot; never estimate from transcript text. |
| message count and message bytes | visible transcript contribution | Bounded local metadata/known session file measurement. |
| structured-state bytes | tool/event/checkpoint/projection data attributable to the thread | Measure by known thread association; label unavailable where association cannot be proven. |
| attachment association/bytes | attributable attachment storage | Count only recognised associations; do not scan arbitrary user files. |
| relevant log bytes | logs with an established thread association | Separate from general application logs. |

Separately show workspace/global categories without falsely attributing them to
a thread: `t3-archives`, Codex logs, T3 cache/IndexedDB, Git worktrees, and Git
object storage. Git inventory remains a separate portfolio hygiene report.

## Required user model

```text
active
  -> durable handoff recorded
  -> archived through supported T3 surface
  -> explicit user deletion after optional export and deletion receipt
```

Archive/delete state is not a role name, Passport, successor identity, or
rotation. One predecessor may be retained temporarily when its durable handoff
is sufficient. A massive thread is never deleted merely because it crossed a
token or byte threshold.

## Delivery order

1. **Read-only inventory adapter.** Add an on-demand command/API surface that
   reports the table above for explicitly selected active/portfolio threads and
   global categories. It must not full-scan historical state continuously.
2. **Portfolio presentation.** Add a compact Session Health destination/card
   to T3 Portfolio Control: total processed, attributable bytes, freshness,
   warning state, and the lifecycle recommendation. Reuse existing native
   project/thread identity.
3. **Warnings.** Configure separate thresholds for token rotation and storage
   concern. Initial values are advisory and user-configurable; a warning
   produces no archival, deletion, agent rotation, or notification send by
   itself.
4. **Durable handoff and archive.** Connect a supported handoff marker and T3
   archive operation only after the inventory/presentation proof. Deletion
   stays an explicit user action with optional export and a compact receipt.

## Non-goals

- No second thread registry, continuous heavy full-history scan, daemon,
  scheduler, or token estimator.
- No manual edit of `.codex` or T3 SQLite, including stale rows.
- No automatic cleanup of the 11 GB archives, Codex backups/logs, caches,
  worktrees, or Git objects.
- No assumptions that a thread's visible text represents its total storage.

## Immediate safe work

1. Preserve the supplied inventory as a dated baseline in a source-controlled
   plan/trajectory receipt.
2. Build the bounded read-only measurement adapter and fixture tests against a
   small synthetic directory tree; exclude user data from Git.
3. Render fixture/explicitly selected data in Portfolio Control.
4. For actual cleanup, create a separate user-reviewed candidate list with
   durable-handoff evidence, category, bytes recoverable, and action:
   retain/archive/delete/inspect. Do not execute it automatically.

## Acceptance

- A selected thread can show native total processed plus truthful attributable
  byte categories or `unavailable`.
- Global archive/log/cache/Git categories are distinct.
- Portfolio Control does not add background heavy scanning.
- A warning does not mutate anything.
- The system can produce a human-reviewable retirement candidate list without
  deciding or executing deletion.

## Handoff

Record sources measured, freshness, un-attributable categories, focused tests,
and any operating-system permission limitation. Do not claim disk space was
recovered unless a separately authorized deletion/archive action completed.
