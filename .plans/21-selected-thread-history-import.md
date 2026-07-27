# Selected-thread history import: first proof

Status: two-thread transactional fixture proof passes; isolated runtime continuation is blocked before startup by a pre-existing server bundle dependency failure.

## Safety boundary

The exporter accepts only a copied legacy SQLite file and opens it read-only.
It does not access `~/.t3/userdata/state.sqlite`, the Desktop backup, an
installed bundle, or a running T3 profile. The target profile is not created
by this tranche.

## Design checkpoint

`apps/server/scripts/t3-selected-thread-export.mjs` is the source-side,
schema-guarded inventory boundary. It requires migration 33 and the three
projection tables (`projection_projects`, `projection_threads`, and
`projection_thread_messages`). It exports deterministic project/thread/message
records, attachment JSON when valid, date ranges, counts, source SHA-256, and a
dry-run `restore_now`/`legacy_only` roster. Activity, orchestration, and tool
payload tables are named as excluded data and are never queried.

`apps/server/scripts/t3-selected-thread-import.mjs` accepts one packet and a
new empty target database. It requires migration 33 and the current projection
columns, rejects production/backup-looking paths and non-empty projection or
provider-session state, creates fresh UUIDs, and imports project/thread/message
projections in one `BEGIN IMMEDIATE` transaction. Imported threads are settled
and have no provider runtime state. A small `t3_selected_thread_imports` table
records the legacy IDs and source SHA as explicit provenance; this is tool-owned
metadata and not a replacement for T3 event history. The importer uses the
repository's projection schema contracts as its SQL shape; the existing T3
event append path is intentionally not used because importing old activity or
provider events is explicitly out of scope.

Repeat behavior is refusal: the target must remain empty, and provenance also
marks the legacy thread ID unique. The receipt includes source SHA, target
schema migration, counts/date range, old-to-new mapping, and excluded
categories.

## Fixture proof

`apps/server/scripts/t3-selected-thread-export.test.mjs` creates a disposable
SQLite fixture, exports exactly one thread, verifies titles, chronological
message text, attachment metadata, excluded-table policy, schema refusal, and
unchanged source SHA-256.

`apps/server/scripts/t3-selected-thread-import.test.mjs` creates separate fresh
target fixtures, imports exactly one packet and exactly two threads in one
project, verifies project/thread titles, workspace root, settled state, message
order/text/attachments, exact counts, per-thread provenance, empty
activity/event/provider-session tables, source SHA immutability, and repeat-
import refusal.

## Disposable runtime continuation attempt

Preflight passed for disposable home `/tmp/t3code-continuation.oJa43H`, target
database `/tmp/t3code-continuation.oJa43H/userdata/state.sqlite`, port `18773`,
and identity `com.t3tools.t3code.continuation-dev`. It reported no listener,
database owner, or Electron lock and showed no overlap with production `~/.t3`,
port 3773, or the production Electron identity. The home was not seeded or
launched after the failure.

The supported server launch/build attempt stopped before runtime startup:
`vp run --filter=t3 build:bundle` fails on the pre-existing unresolved export
`@pierre/diffs/utils/parsePatchFiles` from
`apps/server/src/checkpointing/Diffs.ts`. Therefore no UI/query-path visibility
or fresh continuation message can be claimed. The smallest remaining runtime
proof is to repair or align that existing dependency/toolchain issue in a
separately approved change, then start only this disposable profile, import the
two-thread packet, and send one harmless continuation to one imported thread.

Operational cutover gate: do not migrate a real roster until the disposable
runtime can read the imported projections and demonstrate one supported new
message/turn lifecycle, followed by shutdown evidence and a fresh source
immutability check.
