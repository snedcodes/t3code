# Plan 475: T3 Operational Recovery, Selective History Migration, Storage Control, and Upgrade-Safe Reliability

Date: 27 July 2026  
Owner: T3 Reliability Fork Agent  
Coordinator: Portfolio Overseer  
Status: Diagnosis complete; current Operational launcher rejected for daily use; implementation not yet authorized by this revision  
Priority: Restore reliable T3 work as quickly as possible without losing selected message history or creating a permanent maintenance burden  
Canonical continuity rule: This document replaces further manual chat-history top-ups. Future findings and implementation receipts belong here or in a directly linked successor plan.

## 1. Purpose

This document is the complete recovery and implementation handoff for another
agent to follow sequentially from diagnosis through a reliable daily T3
installation.

It records:

- every confirmed fault found during the failed Operational recovery;
- remaining uncertainties that must not be silently treated as solved;
- the exact reason Portfolio Overseer and T3 Reliability Fork Agent do not load;
- why the current Operational app starts slowly and cannot reopen reliably;
- how to restore selected projects, names, and message histories safely;
- how to prevent activity/event/log bloat without pruning human messages;
- how to avoid filling the Mac disk with successive databases, backups, logs,
  build artifacts, and abandoned runtimes;
- how to preserve compatibility with future official T3 releases;
- the smallest acceptance gate that proves the system is usable;
- the two complete Portfolio Overseer diagnostic responses that prompted this
  corrected plan.

## 2. Scope correction

The original goal was deliberately smaller than the work that followed:

1. install or use a current T3 build;
2. give it a fresh, small database;
3. restore the important project roster and selected message histories;
4. prevent the database from becoming multi-gigabyte again;
5. reconnect VoiceTools after T3 itself works.

The recovery drifted into building a source-backed development launcher and
altering T3 lifecycle code before the core migration was proven. That was the
wrong order.

### Corrected recommendation

The primary recovery path should remain as close to upstream T3 as possible:

- use the latest acceptable official T3 Nightly or stable packaged app;
- give it an isolated clean profile/database;
- use a separate, schema-aware migration utility to import selected projects,
  threads, titles, and messages;
- keep retention/cleanup as a deterministic external maintenance operation
  unless upstream T3 gains a native equivalent;
- keep any unavoidable T3 source changes as a small, documented patch stack or
  upstream pull request;
- do not make a custom source-backed application the default daily runtime.

This keeps future T3 upgrades practical. A new official build should normally
be installable over the application while continuing to use the small
operational profile, subject to an offline database backup and schema
compatibility check.

### Optional hardening path

A custom packaged build is only justified if an official packaged T3 build
cannot:

- target the isolated operational profile;
- coexist safely with the legacy rollback profile;
- load the repaired imported threads;
- support the required retention protection;
- expose or tolerate the VoiceTools integration.

If a custom package is required, it must be produced through T3's real
packaging route. A Vite/dev/watch launcher is never an acceptable daily app.

## 3. User-visible end state

The work is complete only when the user can:

1. click one normal T3 application in Applications or the Dock;
2. see the restored projects and human-readable agent names;
3. open Portfolio Overseer and T3 Reliability Fork Agent immediately;
4. read their imported message histories;
5. send a new message and receive a completion;
6. quit T3 completely;
7. reopen it immediately without a stuck or orphaned process;
8. use future official T3 updates without rebuilding the database from scratch;
9. use VoiceTools to discover, read, and message the replacement sessions after
   a controlled Passport transition;
10. retain human messages while preventing disposable tool/activity history and
    logs from growing without bound.

## 4. Protected sources and current locations

### Legacy Nightly rollback source

- app: `/Applications/T3 Code (Nightly).app`
- T3 home: `/Users/snedmusic/.t3`
- database: `/Users/snedmusic/.t3/userdata/state.sqlite`
- backend port: `3773`
- purpose: immutable migration source and immediate working fallback

### Current Operational experiment

- installed wrapper:
  `/Users/snedmusic/Applications/T3 Operational.app`
- duplicate source-tree wrapper:
  `/Users/snedmusic/snedcodes/t3code/apps/desktop/T3 Operational.app`
- source checkout:
  `/Users/snedmusic/snedcodes/t3code`
- profile:
  `/Users/snedmusic/.t3-operational`
- database:
  `/Users/snedmusic/.t3-operational/userdata/state.sqlite`
- attempted backend port: `3774`
- Vite development port: `5733`
- app identity: `com.t3tools.t3code.operational`
- durable Node runtime:
  `/Users/snedmusic/.t3-operational/toolchain/node24/bin/node`

### Existing Operational backup

- `/Users/snedmusic/.t3-operational/backups/state-before-null-attachments-repair-20260727-1710.sqlite`

Do not create another timestamped backup merely because another repair step is
attempted. See the storage rules below.

## 5. Confirmed findings

### 5.1 The legacy state problem was real

The legacy T3 state database had grown to approximately 3.6 GB even though its
human message history was comparatively small. Most of the size was
orchestration activity, projected activity, tool-event payloads, and related
runtime state rather than user/agent messages.

A clean isolated Nightly profile stayed responsive, including while Chrome was
open. This strongly implicated legacy state size and activity history in the
old profile's endpoint timeouts and sustained CPU use. Chrome may expose
resource pressure, but Chrome alone did not reproduce the failure.

### 5.2 Two identical Operational wrappers exist

The following app bundles both existed:

- `/Users/snedmusic/Applications/T3 Operational.app`
- `/Users/snedmusic/snedcodes/t3code/apps/desktop/T3 Operational.app`

Both were created and last modified at 3:18 PM on 27 July 2026. Both use bundle
identifier `com.t3tools.t3code.operational`, version
`0.0.29-operational`, and the same wrapper executable SHA-256:

`84edc9809a058cbe8ea0d1c9849ea3d8967a5d51b8f481194071a0c5c77c75b0`

They are static shell wrappers pointing back to the source checkout. Source
changes after 3:18 PM can still be executed dynamically, but Finder correctly
continues to show the wrapper's original modification time. This is misleading
for a daily application and makes it impossible for the user to tell whether a
new build was installed.

### 5.3 The current Operational app is a development launcher

The wrapper starts:

- `scripts/t3-operational-launcher.mjs`;
- `scripts/dev-runner.ts dev:desktop`;
- `vp run`;
- a Vite development server;
- a full web build;
- `vp pack --watch`;
- Electron in development mode;
- the T3 backend.

Observed startup timing:

- wrapper start: approximately 5:15:29 PM;
- development runner start: approximately 5:15:32 PM;
- Electron `app ready`: approximately 5:16:20 PM;
- backend listening: approximately 5:16:22 PM;
- main window created: approximately 5:16:23 PM.

Normal launch therefore took approximately 50–55 seconds because it rebuilt and
started a development environment. This is not acceptable for daily use.

The repository already contains proper packaging commands:

- `dist:desktop:dmg`
- `dist:desktop:dmg:arm64`
- `dist:desktop:dmg:x64`

The recovery did not use them.

### 5.4 The outer development process tree survives shutdown

After the Electron window and backend had stopped, the following process tree
was still alive more than twenty minutes later:

- installed wrapper shell;
- Node operational launcher;
- Node development runner;
- `vp run`;
- Vite;
- build-preview/CSS command;
- `cross-env`;
- `vp pack --watch`;
- pack watcher.

At the same time:

- Vite still listened on `127.0.0.1:5733`;
- no Operational backend listened on `3774`;
- the official Nightly backend still listened on `3773`.

This creates a half-dead application: macOS sees a surviving application
process, but no usable Operational window/backend exists. Reopening can bounce
in the Dock, become unresponsive, or fail to create a usable window.

This is a release-blocking failure. The source contains attempted shutdown
logic, including `T3CODE_EXIT_DEV_RUNNER_ON_APP_CLOSE=1`, but observed runtime
behavior proves the complete outer process tree is not reliably terminated.

### 5.5 DevTools behavior is not yet trusted

Development mode opens detached DevTools unless
`T3CODE_OPEN_DEVTOOLS_ON_START=0` reaches the Electron process. The wrapper
sets that variable and source code checks it, but the user observed a DevTools
window during startup. Therefore environment propagation or the launched build
path was not proven.

A real packaged daily build should not enter the development-only branch at
all.

### 5.6 Exact Portfolio Overseer loading failure

Operational thread:

`853d0825-1a06-446f-98da-356be5e5b7e6`

Legacy source thread:

`1f2f56d6-f06c-4672-8118-030a18a4369d`

The imported Portfolio Overseer thread contains:

- 1,038 imported messages;
- 47 messages where `attachments_json` contains JSON literal `null` instead of
  an array.

The first offending message is row 974 in one-based ordering, matching T3's
zero-based error position 973:

`0f240c17-b20a-4168-bd19-ed7c218329e5`

T3's current thread snapshot schema expects an attachment array. One malformed
message causes the complete thread snapshot to fail.

### 5.7 Exact T3 Reliability Fork Agent loading failure

Operational thread:

`e48c94ae-6b3a-4609-ac41-6a06d0037681`

Legacy source thread:

`329e8f4b-9925-4129-860f-6b5608c65636`

The imported T3 Reliability Fork Agent thread contains:

- 121 imported messages;
- 34 messages where `attachments_json` contains JSON literal `null`.

The first offending message is row 80 in one-based ordering, matching T3's
zero-based error position 79:

`a7e56635-eff4-4237-9161-b3c20950d1fa`

### 5.8 Why the prior database repair failed

The previous repair changed database-level SQL `NULL` attachment values to
JSON `[]`. It did not change valid JSON text containing `null`.

These are different states:

- SQL `NULL`
- JSON string content `null`
- JSON empty array `[]`

After the repair:

- SQL `NULL` attachment values were zero;
- invalid JSON values were zero;
- JSON `null` values remained in the two critical threads.

The repair was declared successful based on the wrong validation query.

### 5.9 The UI hides the snapshot failure

When the user clicks Portfolio Overseer or T3 Reliability Fork Agent:

1. the client requests the complete thread snapshot;
2. the server decodes the imported message rows;
3. schema decoding fails at the first JSON `null` attachment;
4. the request returns an internal snapshot failure;
5. the UI stays on `Pick a thread to continue`.

The UI does not clearly tell the user that the selected thread failed schema
validation.

### 5.10 Failed thread loading creates a retry storm

The client repeatedly resubscribed or requested the invalid snapshot
approximately every fraction of a second. The permanent schema failure was
treated like a transient connection problem.

Consequences included:

- thousands of repeated decode errors;
- unnecessary CPU and I/O;
- over 100 MB of trace output in roughly one failed-use interval;
- ten rotated server traces near 10 MB each;
- additional current server, desktop, and child logs.

### 5.11 Retention exists but is not operationally wired

Retention implementation:

`apps/server/scripts/t3-retention-maintenance.mjs`

The intended policy includes:

- 200 activity rows per thread;
- 500 orchestration events per thread;
- three log generations;
- bounded tool summaries;
- age/size-based log handling.

However, repository inspection did not find the maintenance script integrated
into normal Operational startup, shutdown, or a scheduler. It is an explicit
manual command and refuses to operate while the profile is active.

The trace logger also used its own approximate 10 MB generation behavior and
retained at least ten generations, inconsistent with the intended three-file
policy.

### 5.12 Operational storage already grew unnecessarily

At diagnosis, `/Users/snedmusic/.t3-operational` occupied approximately
332 MB, including:

- durable Node binary: approximately 118 MB;
- active Operational database: approximately 12 MB;
- pre-repair database backup: approximately 12 MB;
- server trace generations: over 100 MB;
- desktop and child logs: several additional MB;
- other runtime/configuration files.

The current database itself is small. The immediate storage growth came mainly
from the duplicated runtime/toolchain and retry-generated logs.

### 5.13 Electron cache errors were present

The Operational Electron runtime reported cache creation/structure errors under
its Application Support directory, including Shared Dictionary and Cache_Data
paths. These generated caches are disposable and may contribute to launch
instability, but they do not explain the two deterministic thread schema
failures.

Cache repair must never touch the T3 database, credentials, projects, or
messages.

### 5.14 Operational and Nightly isolation is incomplete

The Operational launcher checks for conflicts when it starts. It cannot prevent
Nightly from being launched afterward. Both were observed running
concurrently:

- Nightly backend on `3773`;
- lingering Operational development tree and Vite on `5733`.

Startup-time one-way checks are not sufficient for two independently launched
apps.

### 5.15 The working tree contains incomplete recovery changes

At the final diagnosis, the T3 checkout contained modified recovery files:

- `apps/desktop/scripts/dev-electron.mjs`
- `apps/desktop/src/window/DesktopWindow.ts`
- `docs/README.md`
- `scripts/T3 Operational.app.md`
- `scripts/t3-operational-launcher.mjs`

Plan 475 was untracked before this rewrite.

These changes must be reviewed rather than assumed correct. Do not stage or
commit unrelated files and do not let the existence of source changes serve as
proof of a working end state.

## 6. Remaining uncertainties

The following have not been disproven and must remain visible:

- other imported fields may use legacy representations incompatible with the
  current schema;
- other threads may contain malformed rows that are not exercised by the first
  render;
- a thread may render but fail when a new message is sent;
- provider/model/turn relationships may be stale after import;
- some MCP/provider configuration may live outside the state imported into the
  new profile;
- OAuth credentials may require separate secure reauthorization;
- generated Electron cache corruption may recur;
- packaged-backend resource resolution may behave differently from development;
- official T3 schema changes may require migration-tool updates;
- VoiceTools may briefly show both old and replacement Passports unless the
  transition is controlled;
- process shutdown may leave provider children even when the main backend exits;
- retention code must be proven not to alter protected messages or project
  metadata;
- automatic updates may replace app code but also introduce a new database
  schema that requires an offline compatibility check.

No agent may claim 100% certainty that every latent upstream T3 defect has been
found. The bounded acceptance gate exists to prove the user workflow, not to
claim all possible defects are known.

## 7. Storage and cleanup discipline

### 7.1 Hard rules

1. Do not create a new database backup at every step.
2. Do not create another legacy database copy. The live legacy database remains
   the active source while the Desktop snapshot created on 27 July 2026 is the
   protected offline recovery copy.
3. Keep only one candidate database during a rebuild.
4. Keep only one accepted Operational database after promotion.
5. Keep the existing pre-repair Operational backup only until the replacement
   is accepted; then request explicit approval to delete it.
6. Never run a retry loop against a permanent schema error.
7. Stop all dev servers, Vite processes, watchers, test runtimes, and temporary
   backends immediately after their bounded use.
8. Remove failed candidate databases and their generated logs after preserving a
   compact text/JSON receipt.
9. Do not retain successive DMGs, ZIPs, unpacked apps, build directories, and
   installed apps. Keep the installed app plus at most one reproducible artifact
   until acceptance, then remove the artifact if not needed.
10. Maintain a cleanup ledger listing every created path and its final
    disposition.

### 7.2 Database copy budget

Maximum intended database set during recovery:

- live legacy database: one;
- existing Desktop legacy recovery snapshot: one, retained only until the
  accepted migration is proven and the user approves its retirement;
- current accepted/candidate operational database: one;
- existing temporary pre-repair backup: one, only until acceptance.

The current recovery temporarily contains these four meaningful database files.
Do not exceed these four without explicit user approval. After acceptance,
remove the temporary Operational pre-repair backup first. Retire the large
Desktop legacy snapshot only after the user explicitly approves doing so.
Prefer an APFS clone
or rebuild from the immutable source rather than full successive copies where
safe and supported.

### 7.3 Runtime and artifact budget

Before implementation, record free disk space. During implementation, report:

- starting free space;
- peak additional space;
- final free space;
- retained artifacts;
- deleted temporary paths.

Recommended budgets:

- total active Operational logs: no more than 30 MB;
- each individual trace: approximately 10 MB maximum;
- trace generations: three maximum;
- failed import logs/receipts: compact text or JSON only;
- Operational database warning: 100 MB;
- Operational database intervention threshold: 250 MB unless human messages
  demonstrably account for the growth;
- no retained Vite/pack/watch output after a packaged artifact is produced.

### 7.4 Existing cleanup candidates

After the replacement path is accepted, assess and request approval for:

- orphaned Operational trace generations;
- disposable Electron caches;
- duplicate source-tree Operational wrapper;
- obsolete checkout-backed installed wrapper;
- durable Node toolchain if the official packaged T3 app no longer needs it;
- pre-repair Operational backup;
- failed build artifacts.

Do not remove the legacy database or accepted Operational database as generic
cleanup.

### 7.5 Measured disk inventory and mandatory cleanup reminder

Read-only audit taken on 27 July 2026:

- Mac data volume:
  - approximately 932 GiB total;
  - approximately 852 GiB used;
  - approximately 54 GiB available;
  - 95% capacity reported by macOS.
- additional recovery footprint, excluding legacy logs and the pre-existing
  repository `node_modules` directory:
  - approximately 4.83 GiB.
- legacy T3 logs created or modified during the day:
  - approximately 428 MiB.
- total recovery and same-day diagnostic footprint requiring reconciliation:
  - approximately 5.25 GiB.

Meaningful databases currently present:

1. `/Users/snedmusic/.t3/userdata/state.sqlite`
   - live legacy database;
   - approximately 3.6 GiB;
   - critical source; do not delete.
2. `/Users/snedmusic/Desktop/T3-state-backup-2026-07-27.sqlite`
   - protected offline legacy recovery snapshot;
   - approximately 3.6 GiB;
   - created during this recovery;
   - retain until the migrated system is accepted;
   - the live legacy database grew by approximately 56.76 MiB after this
     snapshot was taken.
3. `/Users/snedmusic/.t3-operational/userdata/state.sqlite`
   - current Operational candidate;
   - approximately 12 MiB.
4. `/Users/snedmusic/.t3-operational/backups/state-before-null-attachments-repair-20260727-1710.sqlite`
   - temporary Operational pre-repair backup;
   - approximately 12 MiB.

Tiny SQLite sidecar or placeholder files also exist, including the Desktop
snapshot's approximately 32 KiB `-shm` file and empty `-wal` file. These are
not meaningful additional database copies.

Recovery-created or recovery-amplified residue:

- `/Users/snedmusic/.t3-operational`
  - approximately 332 MiB total;
  - approximately 198 MiB Node 24 toolchain;
  - approximately 109 MiB logs;
  - approximately 25 MiB across the candidate database and its temporary
    pre-repair backup.
- `/Users/snedmusic/snedcodes/t3code/apps/desktop/.electron-runtime`
  - approximately 814 MiB;
  - generated Electron development runtime;
  - regenerable.
- generated build outputs:
  - `apps/desktop/dist-electron`: approximately 3.3 MiB;
  - `apps/web/dist`: approximately 54 MiB;
  - `apps/server/dist`: approximately 71 MiB;
  - approximately 128 MiB combined;
  - regenerable.
- Operational application wrappers:
  - `/Users/snedmusic/Applications/T3 Operational.app`;
  - `/Users/snedmusic/snedcodes/t3code/apps/desktop/T3 Operational.app`;
  - approximately 1.9 MiB each;
  - functionally duplicated wrapper content, with the installed copy carrying
    signing metadata.
- `/Users/snedmusic/.t3/userdata/logs`
  - approximately 420 MiB;
  - provider and diagnostic logs, not the canonical human message history;
  - cleanup candidate only after all relevant T3 processes are stopped.
- `/Users/snedmusic/.t3/userdata/attachments`
  - approximately 336 MiB;
  - pre-existing user data;
  - do not delete as generic cleanup.
- `/Users/snedmusic/snedcodes/t3code/node_modules`
  - approximately 4.6 GiB;
  - created before this recovery tranche;
  - only approximately 2.2 MiB changed during the audit day;
  - do not attribute the whole directory to this recovery or delete it without
    accepting that source development will require dependency reinstallation.

Active orphan runtime observed during the audit:

- installed Operational wrapper shell;
- Operational launcher;
- development runner;
- Vite development process;
- `vp pack --watch` process tree.

The Electron window and backend were absent while this outer development tree
remained alive. This is an active disk-growth and lifecycle fault, not merely a
historical observation. Stop this tree before cleanup or further recovery work.
Do not allow it to keep regenerating logs and build output.

Cleanup order after all T3 and Operational processes are stopped:

1. Confirm no T3, Operational, Vite, pack, watcher, Electron, or related backend
   process still owns the affected paths or ports.
2. Remove disposable Operational logs.
3. Remove rotated legacy diagnostic/provider logs after confirming T3 is
   closed; do not remove the message database or attachments.
4. Remove the generated `.electron-runtime` and generated build outputs if the
   source-backed Operational launcher is being abandoned.
5. Remove the redundant source-tree wrapper after the accepted launch route is
   established.
6. Remove the Operational Node 24 toolchain only if the accepted packaged route
   no longer depends on it.
7. Remove failed or superseded Operational candidate databases and the
   temporary 12 MiB pre-repair backup after the accepted candidate is secure.
8. Keep the 3.6 GiB Desktop legacy snapshot until migrated histories open,
   messages can be sent and reloaded, VoiceTools changeover is accepted, and
   the user explicitly approves deleting the snapshot.
9. Record exact reclaimed disk space and remaining database, log, build,
   runtime, and wrapper paths in the cleanup ledger.

Estimated reclaimable space while retaining both the live legacy database and
the large Desktop safety snapshot is approximately 1.6–1.7 GiB, depending on
whether the Node toolchain is still required. A further approximately 3.6 GiB
can be reclaimed only after migration acceptance and explicit approval to
retire the Desktop snapshot.

No cleanup is implicit. The inventory is a mandatory reminder and gate for the
implementing agent; destructive removal still requires exact target resolution
and user approval.

## 8. Upgrade-safe architecture

### 8.1 What should remain outside the T3 fork

Prefer external, versioned tools for:

- selected-project/thread export from the legacy database;
- schema-aware import into an offline fresh profile;
- import validation receipts;
- database-size inspection;
- offline retention maintenance;
- cleanup ledgers;
- VoiceTools transition planning.

These tools can be updated for a new upstream schema without permanently
altering the T3 application.

### 8.2 What may require a small upstream/fork patch

Only patch T3 where external tooling cannot solve the user-facing behavior:

- display a clear thread schema/load error;
- stop retrying permanent decode failures;
- expose diagnostics/database size;
- provide a native import command or UI if upstream accepts it;
- add built-in bounded retention if upstream accepts it;
- repair genuine process ownership bugs in packaged builds.

Each patch should be:

- isolated;
- covered by a focused test;
- documented with its upstream base commit;
- proposed upstream where practical;
- easy to drop when upstream provides an equivalent.

### 8.3 Future official updates

For each official T3 update:

1. retain the currently working application;
2. create no database copy unless the update performs a schema migration;
3. inspect release/schema notes;
4. launch the update against a disposable minimal profile first;
5. validate startup and one harmless thread;
6. if schema-compatible, launch it against the accepted Operational profile;
7. if schema migration is required, create one offline safety copy, update,
   validate, then remove the temporary copy after acceptance;
8. rerun the short user-workflow gate;
9. update or retire any local patch already supplied upstream.

The normal case should be replacing application code while retaining the
small Operational profile—not rebuilding every conversation after every
release.

## 9. Sequential implementation workbook

Another agent should follow these phases in order and stop at any failed gate.

### Phase 0: Re-establish the minimal objective

Deliverable:

- a short written declaration that the primary target is official packaged T3
  plus a clean profile and selective import;
- custom packaging remains conditional, not assumed.

Actions:

1. Read this complete plan.
2. Inspect `git status --short`.
3. Do not modify the legacy database.
4. Do not launch the current Operational wrapper.
5. Do not perform another history top-up.
6. Record current free disk space and existing recovery paths.

Gate:

- no new backup, build, watcher, or database has been created.

### Phase 1: Stop and inventory the abandoned Operational experiment

Actions:

1. Resolve the exact process tree belonging to the Operational wrapper.
2. Confirm Nightly and the current conversation are not part of that tree.
3. With explicit authority, terminate only the orphaned Operational development
   tree.
4. Confirm ports `3774` and `5733` have no listener.
5. Do not terminate Nightly on `3773` until a planned changeover.
6. Inventory existing Operational logs, cache, Node toolchain, wrappers,
   database, and backup.
7. Record all candidates in the cleanup ledger; do not delete them yet.

Gate:

- no Operational dev/watch process remains;
- no unrelated process was stopped.

### Phase 2: Repair the importer

Actions:

1. Locate the selected-thread exporter/importer and append tooling.
2. Define normalization for every imported message field using the current T3
   contracts.
3. Normalize attachment states:
   - missing -> `[]`;
   - SQL `NULL` -> `[]`;
   - JSON `null` -> `[]`;
   - array -> validated/preserved;
   - all other types -> reject with an exact row error.
4. Validate roles, timestamps, content/text parts, attachment objects,
   provider/turn identifiers, ordering, and required foreign references.
5. Use the exact native thread-detail decoder/schema used by the server.
6. Add focused fixtures for:
   - no attachments;
   - SQL `NULL`;
   - JSON `null`;
   - empty array;
   - valid file/image attachment;
   - invalid object/string attachment;
   - Portfolio first failing row;
   - Reliability first failing row.
7. Ensure importer operation is offline and refuses an active target profile.
8. Ensure rerunning the same import is idempotent or refuses duplicates clearly.

Focused validation only:

- importer tests;
- native decoder test;
- no repository-wide suite.

Gate:

- both previously failing rows decode successfully;
- invalid types fail before database promotion;
- no database has yet been replaced.

### Phase 3: Rebuild one candidate database

Actions:

1. Use a temporary candidate path inside the Operational profile or a bounded
   temporary directory.
2. Do not create another source backup.
3. Import the selected roster:
   - Portfolio Overseer;
   - VoiceTools Coordinator Mac;
   - T3 Reliability Fork Agent;
   - Agents Dev Guidelines Work;
   - Ableton Coordinator;
   - AV Transform Coordinator Mac;
   - VolGrid Coordinator Mac;
   - Hummingbot Coordinator Mac.
4. Preserve human-readable project and thread titles.
5. Preserve selected message histories and chronological ordering.
6. Do not import legacy projected activities, orchestration events, trace logs,
   retry history, or tool payload bulk.
7. Generate an import receipt for every thread.
8. Decode every imported thread through the native current schema.
9. Compare expected and imported message counts.
10. Run the database integrity check.
11. If any thread fails, retain the compact receipt and delete the failed
    candidate rather than stacking another database beside it.

Gate:

- all eight selected threads pass native schema decoding;
- Portfolio has its expected imported message count;
- Reliability has its expected imported message count;
- candidate database remains small and integrity check passes.

### Phase 4: Choose upstream packaged runtime first

Actions:

1. Identify the currently installed official latest acceptable Nightly/stable
   packaged app and its version/commit.
2. Determine the supported mechanism for selecting an isolated T3 home/profile.
3. Attempt the accepted candidate profile with the official packaged app.
4. Do not open the current Operational development wrapper.
5. Confirm no Vite, dev runner, or build watcher starts.

Decision:

- if the official packaged app supports the profile and restored threads,
  continue using it;
- if profile isolation cannot be achieved without a tiny launcher, create a
  launcher that starts the already packaged official app, not source/Vite;
- only if official packaging cannot support the required profile/runtime,
  proceed to Phase 5.

Gate:

- the fastest upstream-compatible route has been genuinely attempted before
  custom packaging.

### Phase 5: Conditional genuine package

Only run this phase if Phase 4 records a concrete blocker.

Actions:

1. Review the local T3 changes and discard no unrelated work.
2. Build through the repository's real macOS artifact route.
3. Do not use `dev:desktop`, Vite, `vp pack --watch`, or a source wrapper.
4. Use a unique product name, bundle identifier, profile, and port.
5. Embed the compiled backend/frontend resources.
6. Disable automatic DevTools by using packaged production mode.
7. Install one app at:
   `/Users/snedmusic/Applications/T3 Operational.app`.
8. Keep at most one build artifact until acceptance.
9. Remove unpacked/transient artifact output after successful installation.
10. Record build commit and build time in diagnostics.

Gate:

- app launches without the source checkout, Vite, watchers, or external Node;
- Finder shows the new packaged app rather than the 3:18 wrapper.

### Phase 6: Lifecycle and single-instance proof

Actions:

1. Launch once and record startup duration.
2. Click the app again and confirm it focuses the existing window.
3. Confirm one backend owns the operational port.
4. Confirm no dev/build ports or watchers exist.
5. Quit normally.
6. Confirm every owned backend/provider child exits within a bounded timeout.
7. Confirm the operational port and database have no owner.
8. Reopen immediately.
9. Confirm stale-process recovery does not touch Nightly or unrelated Node
   processes.
10. Define and enforce the policy for Nightly and Operational coexistence:
    separate profiles/ports and no simultaneous ownership of the same DB.

Gate:

- no outer runner, Vite process, build watcher, provider child, or backend
  remains after Quit;
- reopen works immediately.

### Phase 7: User-workflow acceptance

This is intentionally short, not a soak test.

Actions:

1. Open Portfolio Overseer and verify message history renders.
2. Open T3 Reliability Fork Agent and verify message history renders.
3. Open the other six selected threads once.
4. Send one harmless message to Portfolio Overseer.
5. Confirm a completion appears.
6. Reload Portfolio Overseer.
7. Quit and reopen once.
8. Reopen Portfolio and Reliability again.

Gate:

- all actions succeed without the starter placeholder, schema error, retry
  storm, or stuck process.

### Phase 8: Error and retry hardening

This phase may be deferred until after the user is working if the accepted
upstream app and repaired database are stable.

Actions:

1. Classify schema/decode failures as permanent.
2. Display one actionable visible error.
3. Stop automatic rapid retry for permanent failures.
4. Use bounded exponential backoff only for transient transport errors.
5. Cap subscription recreation and duplicate snapshot requests.
6. Add a focused regression test proving one malformed thread does not create a
   retry/log storm.

Gate:

- one failure produces one bounded diagnostic chain.

### Phase 9: Retention and disk protection

Actions:

1. Preserve human messages, project rows, thread rows, and import provenance.
2. Compact or prune disposable activity/orchestration/tool payload history.
3. Reconcile trace logger generations with the intended three-generation limit.
4. Integrate offline maintenance at a safe lifecycle point or provide one
   deterministic scheduled command.
5. Refuse retention against an active database.
6. Emit a compact retention receipt with before/after sizes and protected-table
   counts.
7. Add a startup diagnostic warning for database/log budgets.
8. Verify maintenance leaves message counts unchanged.
9. Delete generated test profiles and logs after the focused check.

Gate:

- messages unchanged;
- logs and activity history bounded;
- no new permanent backup layer created.

### Phase 10: VoiceTools changeover

Only begin after the T3 acceptance gate passes.

Actions:

1. Start the accepted T3 runtime only.
2. Let VoiceTools automatically discover its new sessions.
3. Resolve canonical Passports.
4. Compare old and replacement human titles/project assignments.
5. Avoid phone-visible duplicates by performing a controlled inventory
   transition.
6. Authoritatively read Portfolio Overseer.
7. Send one harmless proof through the canonical VoiceTools wrapper.
8. Require transcript confirmation.
9. Confirm phone visibility and readback.
10. Preserve the old legacy Passport mapping only as rollback documentation,
    not a competing active identity.

Gate:

- replacement sessions appear once;
- authoritative readback works;
- send is transcript-confirmed.

### Phase 11: Final cleanup

Actions:

1. Review the cleanup ledger.
2. Remove only confirmed disposable items with explicit user approval:
   - orphan logs;
   - generated caches;
   - generated `.electron-runtime`;
   - failed candidate DB;
   - duplicate wrapper;
   - obsolete Node toolchain;
   - obsolete build artifacts;
   - pre-repair backup after the accepted DB and legacy source are both secure.
3. Keep the live legacy database until the user explicitly retires it.
4. Keep the large Desktop legacy snapshot until migrated histories, sending,
   reload, and VoiceTools transition are accepted; then request explicit
   approval before deleting it.
5. Record final disk-space recovery.
6. Commit only coherent source/docs/tooling changes; never commit databases,
   logs, caches, packaged apps, Node runtimes, or credentials.

Gate:

- one daily app;
- one accepted Operational database;
- one legacy rollback source;
- no orphan runtime;
- bounded logs;
- documented upstream update process.

## 10. Minimal acceptance checklist

- [ ] Current Operational dev wrapper is not used as the daily app.
- [ ] Only one intended T3 daily app is visible in Applications/Dock.
- [ ] No Vite/dev-runner/build watcher starts with the daily app.
- [ ] Startup is reasonably fast.
- [ ] Portfolio Overseer opens.
- [ ] T3 Reliability Fork Agent opens.
- [ ] All remaining priority threads open.
- [ ] Portfolio accepts one new message and completion.
- [ ] Quit removes every owned process/listener.
- [ ] Immediate reopen works.
- [ ] Human message counts remain unchanged after retention.
- [ ] Logs remain within budget.
- [ ] VoiceTools resolves replacement Passports.
- [ ] VoiceTools readback is authoritative.
- [ ] One VoiceTools send is transcript-confirmed.
- [ ] Temporary databases, logs, runtimes, and build artifacts are reconciled.

## 11. Prohibited shortcuts

- Do not patch the live database while T3 owns it.
- Do not declare success from `PRAGMA quick_check` alone.
- Do not validate only SQL `NULL`; validate decoded JSON types.
- Do not use the presence of sidebar titles as proof that threads load.
- Do not use command acceptance as proof that a message or VoiceTools send
  completed.
- Do not present a development launcher as a packaged application.
- Do not leave watchers after closing a validation run.
- Do not create another backup before checking whether the existing immutable
  source and pre-repair backup are sufficient.
- Do not run long soak tests unless a later defect specifically requires one.
- Do not delete the legacy database as disk cleanup.
- Do not make upstream upgrades depend on manually rebuilding every thread.

## 12. Complete prior diagnostic response 1

The following Portfolio Overseer response is preserved in full:

> You are right to be angry. The recovery was declared usable before the two sessions you actually need were tested. I treated several intermediate repairs as completion instead of validating the complete daily-use outcome.
>
> I made no changes during this diagnosis.
>
> ## What is actually happening
>
> There are four separate faults.
>
> ### 1. Portfolio Overseer and T3 Reliability Fork contain malformed imported messages
>
> The sessions exist, their names and most of their histories were imported, but some imported message rows contain:
>
> ```json
> "attachments": null
> ```
>
> Current T3 expects:
>
> ```json
> "attachments": []
> ```
>
> Exact findings:
>
> - Portfolio Overseer:
>   - 1,038 messages imported.
>   - 47 messages contain the wrong attachment representation.
>   - The first failure is message 974, matching T3’s error at zero-based position 973.
> - T3 Reliability Fork:
>   - 121 messages imported.
>   - 34 messages contain the wrong representation.
>   - The first failure is message 80, matching T3’s error at position 79.
>
> When T3 requests either complete thread, the server rejects the snapshot. The UI fails to show that error and simply remains on “Pick a thread to continue.”
>
> That explains why other imported sessions open while precisely these two do not.
>
> The previous repair was incomplete: it converted database-level `NULL` values to `[]`, but did not convert the JSON text value `"null"`. That distinction was missed.
>
> ### 2. “T3 Operational.app” is not a properly packaged application
>
> The existing application is a small launcher wrapper. It points back into the source repository and launches:
>
> - the development runner;
> - Vite;
> - a complete web build;
> - the Electron build watcher;
> - the T3 backend;
> - Electron itself.
>
> That is why startup takes about 50–55 seconds. It is rebuilding and launching a development environment every time.
>
> The repository already has a genuine packaged-build route through `dist:desktop:dmg`. That should have been used for the daily application.
>
> ### 3. The 3:18 PM timestamp is real, but misleading
>
> There are two identical launcher copies:
>
> - `/Users/snedmusic/Applications/T3 Operational.app`
> - `/Users/snedmusic/snedcodes/t3code/apps/desktop/T3 Operational.app`
>
> Both were created at 3:18 PM, have the same bundle identifier and contain the same executable.
>
> Source-code changes after 3:18 may still be picked up because the wrapper runs source from the repository. Finder does not update the wrapper timestamp when source files change.
>
> So the timestamp does not prove that later source changes were ignored—but it proves that nobody rebuilt and installed a proper updated app. Leaving two identically named wrappers was also a poor and confusing result.
>
> ### 4. Quitting leaves an orphaned development stack
>
> The Electron window and backend shut down, but the outer development runner, Vite server and build watcher remain alive.
>
> I observed:
>
> - the Operational backend on port 3774 was gone;
> - the Vite server on port 5733 remained;
> - the launcher and build-watch processes remained.
>
> This creates a half-dead application: no working window or backend, but enough old processes remain to interfere with reopening. That explains the bouncing Dock icon and subsequent “not responding” behaviour.
>
> Clicking the broken sessions also caused an aggressive retry loop. T3 repeatedly requested the invalid snapshot, generating many megabytes of trace output. The documented retention policy is not currently wired reliably into startup or shutdown.
>
> Chrome is not the underlying cause. It may expose resource pressure, but the clean-profile test worked with Chrome open. The malformed imported data, development launcher and orphaned process tree are sufficient to explain the failures.
>
> ## Complete recovery plan
>
> ### Phase 1 — Restore usability without touching your legacy system
>
> Keep the existing Nightly and legacy database intact as the fallback. Do not delete or overwrite either database.
>
> Repair must happen against a new reproducibly generated Operational database, not through another succession of undocumented manual patches.
>
> The importer must normalize all of these to an empty array:
>
> - missing attachments;
> - database `NULL`;
> - JSON `null`;
> - undefined attachment values.
>
> It must then validate every imported message using the same schema that T3 uses when loading a thread—not merely check that the SQLite database is structurally valid.
>
> ### Phase 2 — Regenerate the Operational database
>
> Create a new database from the preserved recovery packets and legacy source, retaining:
>
> - project names and paths;
> - thread names;
> - message histories;
> - ordering and timestamps;
> - the selected active roster;
> - model/reasoning configuration where portable.
>
> Generate a receipt containing, for every imported thread:
>
> - source and destination identity;
> - project assignment;
> - message count;
> - earliest and latest message;
> - number of normalized rows;
> - any rejected row and exact reason.
>
> Do not replace the current Operational database until the new one passes the short gate below.
>
> ### Phase 3 — Use a real packaged application
>
> Build the actual Electron application using the repository’s packaged distribution route.
>
> The finished application must:
>
> - live only at `/Users/snedmusic/Applications/T3 Operational.app`;
> - be self-contained rather than depend on Vite or a source watcher;
> - use `~/.t3-operational` and port 3774;
> - never open DevTools automatically;
> - display its commit/build date in diagnostics;
> - start in roughly 5–15 seconds;
> - contain one unambiguous icon and application entry.
>
> The duplicate source wrapper should be renamed or removed only after the packaged app is proven.
>
> ### Phase 4 — Repair lifecycle ownership
>
> The packaged application must own the complete process tree.
>
> Required behaviour:
>
> - first launch starts one backend;
> - clicking the icon again focuses the existing window;
> - Quit terminates Electron, backend and provider children;
> - no port 3774 listener remains after Quit;
> - no Vite or build watcher exists in normal daily use;
> - a stale previous process is detected and recovered safely.
>
> Operational and Nightly should not run against the same profile. If both are open, they must use explicitly separate databases and ports.
>
> ### Phase 5 — Prevent recurrence
>
> The importer must be idempotent and repeatable so future migrations do not require surgical database edits.
>
> Runtime protections:
>
> - validate a thread once before serving it;
> - surface a visible “thread data invalid” error rather than silently showing the starter screen;
> - stop rapid retries after a schema error;
> - use bounded exponential retry only for genuine temporary failures;
> - rotate trace logs automatically;
> - retain at most three small trace generations;
> - run deterministic retention during startup or clean shutdown;
> - preserve messages while pruning disposable activity/tool-event history;
> - expose current database size, activity count and log size in diagnostics;
> - warn before the state database reaches a defined budget.
>
> ### Phase 6 — Reconnect VoiceTools only after T3 works
>
> Once the packaged app is stable:
>
> 1. Let VoiceTools automatically discover the restored T3 sessions.
> 2. Resolve their new Passports.
> 3. Replace the old phone entries cleanly rather than showing duplicates.
> 4. Verify authoritative readback.
> 5. Send one harmless proof message.
> 6. Require transcript confirmation.
> 7. Confirm the restored sessions are visible and readable on the phone.
>
> ## Minimal acceptance gate
>
> This does not require a large testing project. Before declaring completion, only these checks are necessary:
>
> 1. Launch the packaged app once.
> 2. Open Portfolio Overseer and confirm its history appears.
> 3. Open T3 Reliability Fork and confirm its history appears.
> 4. Open the remaining restored sessions once.
> 5. Send one harmless message to Portfolio Overseer and reload it.
> 6. Quit and reopen the app once.
> 7. Confirm no orphaned process or retry storm remains.
> 8. Confirm VoiceTools readback and one transcript-confirmed send.
>
> If either critical thread does not open, the migration is not complete.
>
> ## Recommended immediate direction
>
> Use the existing Nightly for work today. Do not rely on the current Operational wrapper.
>
> The next implementation tranche should be given entirely to the T3 Reliability Fork Agent as one start-to-finish recovery job:
>
> 1. correct importer normalization;
> 2. regenerate the Operational database;
> 3. validate the restored roster;
> 4. build a genuinely packaged application;
> 5. fix quit/reopen ownership;
> 6. pass the eight checks above;
> 7. only then perform the VoiceTools changeover.
>
> No further chat-history top-ups should be done manually. The import pipeline must become the authoritative repeatable mechanism.

## 13. Complete prior diagnostic response 2

The following Portfolio Overseer response is preserved in full:

> No. I cannot honestly guarantee that every latent T3 defect has been found before the repaired application exists and runs. I can say with certainty that the current Operational app is not fit for daily use, and we now have enough evidence to stop patching it incrementally.
>
> The remaining Vite/dev-runner/build-watcher processes are completely unacceptable. Twenty minutes after the window closed, I confirmed this entire orphaned tree was still running:
>
> - Operational launcher
> - Node launcher
> - T3 development runner
> - Vite
> - `vp run`
> - desktop build command
> - `vp pack --watch`
>
> Port 5733 was still listening, while the actual Operational backend on 3774 was gone. That is a half-dead development environment, not an application.
>
> ## What is proven
>
> These are not hypotheses:
>
> 1. Portfolio Overseer cannot load because 47 imported messages contain JSON `null` attachments instead of arrays.
> 2. T3 Reliability Fork cannot load for the same reason across 34 messages.
> 3. The current launcher starts an entire development/build stack on every launch.
> 4. Startup consequently takes approximately 50–55 seconds.
> 5. Quitting Electron does not terminate the outer process tree.
> 6. Reopening then encounters an orphaned partial instance.
> 7. Both visible “T3 Operational” apps are identical wrappers created at 3:18 PM.
> 8. Neither is a newly compiled packaged application.
> 9. Clicking the malformed threads causes a rapid snapshot retry storm.
> 10. That storm produced over 100 MB of trace logs in roughly a minute.
> 11. The retention utility exists but is not automatically integrated into normal startup or shutdown.
> 12. Operational’s Electron cache has also reported corrupted/invalid cache structures.
> 13. Nightly and Operational can still end up running concurrently because the current exclusion check only happens when Operational starts.
> 14. The repository already contains a real macOS packaging route, but it was not used.
>
> ## What may still be wrong
>
> These need to be treated as explicit investigation items, not silently assumed solved:
>
> - Other imported fields may contain legacy representations incompatible with the current schema.
> - Other threads may have malformed data that happens not to fail until a specific part of their history is requested.
> - Imported turn/provider state could be stale even where messages render.
> - Some imported threads may open but fail on their next message.
> - DevTools previously opened despite the launcher intending to disable them; environment propagation needs proof.
> - Cache corruption may persist independently of the database repair.
> - Provider/MCP configuration may not be fully portable into a packaged profile.
> - Quit handling may also leave provider subprocesses, not only Vite/build processes.
> - Existing single-instance logic may not distinguish Operational, Nightly and source-development builds robustly in both launch directions.
> - VoiceTools discovery may temporarily expose both old and replacement sessions.
> - Automatic retention might accidentally affect message tables unless its protected-table guarantees are verified in the real profile.
> - The proper packaged app may expose platform-specific signing, permissions or Node/backend-resource problems not seen in development mode.
>
> These are why “we fixed the 81 attachment values” would still not be an acceptable end state.
>
> ## Correct decision: discard the current Operational launcher as the daily app
>
> We should not keep improving this wrapper and hope it becomes reliable.
>
> It may remain as an explicitly named developer launcher, for example:
>
> `T3 Operational Dev.app`
>
> But the actual daily application must be a packaged Electron build with:
>
> - no Vite;
> - no `vp pack --watch`;
> - no source watcher;
> - no development runner;
> - no automatically opened DevTools;
> - embedded compiled frontend and backend;
> - deterministic process ownership;
> - one installed copy.
>
> ## Full start-to-finish recovery
>
> ### 1. Preserve the sources
>
> Preserve without modification:
>
> - legacy T3 database;
> - current recovery packets;
> - current Operational database;
> - existing pre-repair backup;
> - current project/thread roster.
>
> No destructive cleanup happens before the replacement app passes.
>
> ### 2. Repair the importer, not merely this database
>
> The importer must normalize every message field before insertion.
>
> For attachments:
>
> - missing → `[]`
> - database `NULL` → `[]`
> - JSON `null` → `[]`
> - valid array → preserve
> - invalid object/string/number → reject with a row-specific error
>
> The same principle must cover all current message fields, including roles, timestamps, text parts, images/files, provider identifiers and turn relationships.
>
> Every generated thread must be decoded with T3’s real current thread-detail schema before it is accepted.
>
> ### 3. Regenerate a clean Operational database
>
> Do not keep layering fixes onto the current database.
>
> Generate a new database from the preserved source material and produce an import receipt containing:
>
> - project;
> - thread title;
> - source identity;
> - destination identity;
> - message count;
> - normalized row count;
> - rejected row count;
> - earliest/latest message;
> - schema-validation result.
>
> Only replace the current Operational database after the replacement database passes the bounded session checks.
>
> ### 4. Build a genuine packaged app
>
> Use the existing macOS artifact route, which already supports DMG/ZIP packaged applications.
>
> The finished application must be copied to exactly:
>
> `/Users/snedmusic/Applications/T3 Operational.app`
>
> It must have:
>
> - a unique bundle identifier;
> - a unique application-data directory;
> - its own port;
> - a visible build commit and build time;
> - no source-repository dependency;
> - no Node installation dependency for normal launch;
> - no duplicate source-tree `.app` with the same name.
>
> A newly built application should naturally have a new modification time. The 3:18 wrapper will no longer be relevant.
>
> ### 5. Fix lifecycle ownership before daily use
>
> The packaged app must provide one ownership chain:
>
> ```text
> T3 Operational.app
> ├── Electron main process
> ├── packaged backend
> └── active provider children
> ```
>
> It must never start Vite or a build watcher.
>
> Required lifecycle behaviour:
>
> - clicking once launches;
> - clicking twice focuses the first instance;
> - closing a window follows the intended macOS window policy;
> - Quit stops every owned child;
> - bounded graceful shutdown;
> - forced termination after a short timeout;
> - no process, listener or database owner remains;
> - reopening works immediately;
> - stale ownership is detected and repaired;
> - Nightly and Operational cannot accidentally claim one another’s database or port.
>
> This is a hard release gate.
>
> ### 6. Repair failure presentation and retry behaviour
>
> A malformed thread should produce one visible error such as:
>
> > This imported thread contains incompatible data. It has not been modified. Run repair or return to the roster.
>
> It must not:
>
> - remain silently on “Pick a thread”;
> - retry several times per second;
> - create 100 MB of logs;
> - consume a CPU core.
>
> Permanent schema failures should not retry. Temporary network failures can use bounded exponential backoff.
>
> ### 7. Wire automatic retention properly
>
> Retention must become a normal operational feature rather than a manual script.
>
> Recommended limits:
>
> - keep all human messages;
> - keep all project/thread metadata;
> - retain at most 200 recent rendered activity records per thread;
> - retain at most 500 compact orchestration events per thread;
> - compact completed tool payloads into small receipts;
> - rotate each trace around 10 MB;
> - retain no more than three generations;
> - expire diagnostic logs after 7–14 days;
> - report database/log sizes in diagnostics;
> - warn when state exceeds a configured budget.
>
> Retention should run only while the database is not actively being written, such as controlled startup before backend ownership or after confirmed shutdown.
>
> ### 8. Handle generated cache separately
>
> Electron browser caches are disposable. The packaged app should safely recreate its generated cache if corruption is detected.
>
> This must never touch:
>
> - T3 database;
> - messages;
> - project roster;
> - credentials;
> - provider configuration.
>
> ### 9. Run the smallest meaningful acceptance gate
>
> No long soak test is necessary.
>
> Required checks:
>
> 1. Cold launch the packaged app.
> 2. Confirm no Vite/dev/watch process exists.
> 3. Confirm startup time is reasonable.
> 4. Open Portfolio Overseer.
> 5. Open T3 Reliability Fork.
> 6. Open every other restored priority session once.
> 7. Send one harmless message in Portfolio Overseer.
> 8. Confirm it completes and reloads.
> 9. Quit.
> 10. Confirm all owned processes and listeners disappear.
> 11. Reopen immediately.
> 12. Confirm the two critical sessions still load.
> 13. Confirm log sizes remain bounded.
>
> Any failure prevents changeover.
>
> ### 10. Reconnect VoiceTools last
>
> Only after T3 itself passes:
>
> - automatic registry detection;
> - Passport resolution;
> - authoritative message readback;
> - one transcript-confirmed send;
> - clean replacement of old phone entries;
> - no visible duplicate agents.
>
> ## The operational rule going forward
>
> There should be three clearly separated concepts:
>
> - **T3 Nightly** — vendor application and emergency fallback.
> - **T3 Operational** — stable packaged daily application.
> - **T3 Operational Dev** — source-backed Vite/watch environment used only for development.
>
> They must have separate names, bundle identifiers, profiles, ports and icons. A development launcher must never be presented as the finished operational application again.
>
> ## Confidence statement
>
> I am effectively certain about the immediate causes of:
>
> - the two critical threads not loading;
> - the slow startup;
> - the failure to reopen;
> - the duplicated application entries;
> - the log explosion.
>
> I am not claiming all hidden defects are already known. The plan explicitly covers the remaining uncertainty by validating every imported row, switching to a real packaged build, proving lifecycle ownership, and using a short end-to-end acceptance gate.
>
> The earlier failure was accepting “the code for a repair exists” as proof that the user-facing recovery was complete. From here, completion must mean: you can launch one real app, open both critical sessions, work, quit, and reopen without residue.

## 14. Handoff instruction for the implementing agent

Do not begin by editing lifecycle code or building an app.

First prove the smallest upstream-compatible route:

1. importer corrected;
2. one candidate database regenerated;
3. all selected histories decode;
4. candidate opened with an official packaged T3 build;
5. user workflow proven;
6. storage reconciled;
7. VoiceTools transitioned.

Only implement or package a fork when an exact blocker demonstrates that the
official packaged build cannot deliver that route.

At every phase, report:

- exact paths created;
- exact paths removed;
- disk usage before and after;
- database count and sizes;
- processes/listeners started and stopped;
- focused validation performed;
- whether the phase gate passed;
- whether any upstream compatibility risk was introduced.
