# Selected-thread history import: first proof

Status: one-thread importer implemented and fixture-proven; two-thread proof remains gated.

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

`apps/server/scripts/t3-selected-thread-import.test.mjs` creates a separate
fresh target fixture, imports exactly one packet, verifies project/thread
titles, workspace root, settled state, message order/text/attachments, exact
count, empty activity/event tables, provenance, and repeat-import refusal. No
T3 runtime or production service is started. The exact next gate is a
two-thread proof only after this one-thread proof remains green against a
current-schema disposable target.
