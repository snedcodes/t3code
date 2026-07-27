# Selected-thread history import: first proof

Status: first deliverable implemented; import remains intentionally unimplemented.

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

The later importer must use the current T3 persistence/schema layer, create
fresh target IDs plus explicit legacy provenance, write projects/threads/messages
in one transaction, and settle imported threads. It must refuse a target that
is not an isolated empty profile and must verify source hash, count/order/text,
and target responsiveness before any two-thread proof.

## Fixture proof

`apps/server/scripts/t3-selected-thread-export.test.mjs` creates a disposable
SQLite fixture, exports exactly one thread, verifies titles, chronological
message text, attachment metadata, excluded-table policy, schema refusal, and
unchanged source SHA-256. It does not perform an import or launch T3.
