# Selected-thread history import: first proof

Status: two-thread transactional fixture proof passes; bundled server runtime is proven in isolation, but fresh continuation remains blocked by the web/RPC proof boundary.

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

## Dependency repair and runtime attempt

Diagnosis classified the original server failure as a stale/incomplete
workspace install exposing the unpatched `@pierre/diffs` package export map,
not a lockfile version mismatch or a changed parser API. The package root
already exports `parsePatchFiles`; the checkout's patch adds the subpath export
for other clients, but the materialized package copies did not contain that
patched `package.json` export. A scoped Node 24.18.0/pnpm 11.10.0 reinstall
was used only to restore the lockfile install; global Node, pnpm defaults, and
dependency versions were not changed.

The smallest durable server repair is in
`apps/server/src/checkpointing/Diffs.ts`: it imports `parsePatchFiles` from the
stable package root. This is upstream-compatible with the current package
runtime and leaves the existing workspace patch intact for web/mobile clients.
The actual T3 migration table was also corrected from the fixture's mistaken
`id` column to T3's real `migration_id` column in the exporter/importer guards
and fixtures.

Validation: `vp run --filter=t3 build:bundle` succeeds; focused Diffs,
exporter, and importer tests pass (8 tests total). A fresh isolated server ran
all migration 1--33 steps, listened on `127.0.0.1:18774`, restarted against
the imported target, served `/.well-known/t3/environment`, and read the two
imported settled threads/messages through the supported server persistence
database. The copied source SHA remained
`2a17d68cb8c8ba932e94fe9d9ee83fb1be8fc5e1e1abb76db00fa158db846ec3` before
and after export/import. The target contained zero activity, event, and
provider-session rows.

The full web stack still fails dependency scanning because
`apps/web/src/lib/diffRendering.ts`, `apps/web/src/reviewCommentContext.test.ts`,
and `apps/mobile/src/features/review/reviewModel.ts` retain the same unavailable
`@pierre/diffs/utils/parsePatchFiles` subpath (and the web optimize-deps config
also reports a missing `@clerk/clerk-js`). A direct disposable WebSocket RPC
probe did not complete, so no fresh continuation message or turn is claimed.
The next proof must either repair the remaining client imports/install links in
a separately focused client-boundary change or use the supported web client
after that dependency issue is resolved. Readiness remains blocked for
operational migration.

## Priority-correction disposable web proof

To unblock the practical proof, the remaining client diff-parser imports were
changed to the package root and the stale `@clerk/clerk-js` Vite optimize-deps
entry was removed. This is a fork-local workaround for the materialized
workspace export mismatch; it is intentionally narrower than a dependency
upgrade and should be replaced when the workspace patch is reliably applied.

Focused bundle validation passed after the workaround. A full isolated dev
runtime started with disposable home `/tmp/t3code-runtime-proof.SJ7sT1`,
database `/tmp/t3code-runtime-proof.SJ7sT1/userdata/state.sqlite`, server port
18774, and web port 5733. Production state, identity, and port 3773 were not
targeted. The web application listed both imported threads and opened
`legacy-thread-a` through the real application/server path, displaying its
imported title and native messages. The initial fixture attachment metadata
was normalized only in the disposable target to the current `ChatAttachment`
shape so the supported query decoder could read it.

The harmless continuation text was accepted and persisted as a new user
message in the disposable projection. The provider turn did not start:
Codex app-server spawn stopped at the disposable workspace boundary because
`/tmp/t3-disposable-workspace` did not exist when the request was made. No
assistant response or settled turn is claimed. The runtime was stopped with
Ctrl-C and the isolated listener was released. Readiness remains `blocked`
for operational migration and for claiming a complete continuation proof.
The exact next gate is to rerun this disposable proof with the workspace
directory created before launch, then verify a normal persisted turn/message
lifecycle.

## Final disposable continuation proof

The final proof used fresh disposable home
`/tmp/t3code-final-proof2.nMh3wF`, database
`/tmp/t3code-final-proof2.nMh3wF/userdata/state.sqlite`, server port `18777`,
web port `5733`, and workspace `/tmp/t3-disposable-workspace` created before
launch with only a README marker. The copied fixture source was
`/tmp/t3code-final-source2.VpYhr1/state.sqlite`; production state, installed
T3, the legacy source/backup, and real workspaces were not used.

The two-thread packet imported one project, two settled threads, and four
messages. The isolated application opened `Disposable Agent B` and displayed
its native imported history. The harmless message `Disposable final
continuation proof: reply briefly.` persisted, Codex app-server started in
the disposable workspace, and the application returned `Proof confirmed.`.
Read-only SQLite verification recorded a completed turn with matching pending
and assistant message IDs, requested/started time `2026-07-27T03:19:00.611Z`,
and completed time `2026-07-27T03:19:09.971Z`. The runtime stopped by terminal
interrupt and `lsof` showed no listener on 18777. This is a go result for the
isolated selected-thread continuation proof, not authorization to migrate a
real roster or modify production state.
