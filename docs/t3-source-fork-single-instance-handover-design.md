# T3 source-fork single-instance handover design

Status: documentation and evidence tranche only. No application, process,
profile, database, session, or Heartbeat state was changed while preparing this
document.

## Purpose

Define a reviewable way to inspect and use the Mac source fork with the user's
real native T3 projects, threads, and session history while guaranteeing that
only one T3 instance owns the working profile at a time. The fork's current
Portfolio Control surface is a read-only native shell: Agents link to native
threads; Heartbeats are paused configuration only.

This design is grounded in the repository's [fork plan](../.plans/27-t3-fork-portfolio-and-rolling-release-plan.md),
[Portfolio Control plan](../.plans/30-portfolio-control-draft-workspace.md),
[host profile](../../agents-dev-guidelines/DOCS/OPERATIONS/HOST_PROFILES/T3CODE_2026-08-14.md),
[Operational app guidance](../scripts/T3%20Operational.app.md), and
[rollback guidance](../scripts/T3%20Operational%20Rollback.md).

## Non-goals

- No handover, launch, quit, restart, build, package, install, update, deploy,
  migration, or database edit is authorized by this document.
- No second T3 registry, broker, poller, scheduler, permanent agent service,
  VoiceTools migration, or Heartbeat activation.
- No automatic resend of pending prompts and no direct SQLite coordination.
- No claim that the source fork can safely open the official profile until the
  compatibility gates below have passed.

## Verified repository facts

- The documented official rollback application is
  `/Applications/T3 Code (Nightly).app`, with home/profile
  `/Users/snedmusic/.t3`, database
  `/Users/snedmusic/.t3/userdata/state.sqlite`, and backend port `3773`.
- The documented source-backed Operational experiment uses
  `/Users/snedmusic/snedcodes/t3code`, profile `/Users/snedmusic/.t3-operational`,
  database `/Users/snedmusic/.t3-operational/userdata/state.sqlite`, backend
  port `3774`, web port `5733`, and app identity
  `com.t3tools.t3code.operational`.
- The source package defines `dev:desktop` as
  `node scripts/dev-runner.ts dev:desktop`; the Operational launcher adds
  `--home-dir`, `--port`, and `--dev-url` and selects a verified Node 24.
- The current fork contains the Portfolio Control route and a pure,
  paused-by-default Heartbeat model. It derives selectable targets from active
  native T3 thread shells and does not persist, poll, schedule, dispatch, or
  call VoiceTools.
- The host profile identifies commit `9df4b305a28190018075655a452e448a8897d733`
  as its approved build-source commit. This checkout is currently at a later
  fork commit, so that profile is not evidence that this checkout is approved
  build source.

## Single-instance state model

The working profile has exactly one owner. “Owner” means the process family
that has the profile's database open and/or is serving its backend. The state
machine is:

| State                     | Allowed owner              | Required interpretation                                                                                      |
| ------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `OFFICIAL_ACTIVE`         | Installed official T3 only | Real user state is live; source fork must not open the official profile.                                     |
| `QUIESCED_SNAPSHOT_READY` | None                       | Official T3 is closed; one user-approved snapshot and its receipt exist; no source instance has started.     |
| `FORK_ACTIVE`             | Source fork only           | Fork is using the approved working copy of native state; Heartbeats remain paused.                           |
| `RETURNING`               | None during transfer       | Fork is closed and ownership checks are clear before official T3 is opened.                                  |
| `ROLLBACK_REQUIRED`       | None                       | Any ownership, compatibility, integrity, or startup uncertainty blocks use until restore conditions are met. |

The invariant is: never open both desktop profiles against the same database,
never run official and fork backends concurrently, and never treat a stale
window or Dock icon as proof of quiescence. A transition receipt must record
the state, profile path, database path, backend port, process/database-owner
check, and timestamp. If any check is inconclusive, remain stopped.

The intended real-state arrangement is one read-only snapshot of the official
profile followed by one working copy for the fork. The fork may inspect the
user's real projects, native threads, and existing session history from that
working copy; it must not create a parallel identity registry or rewrite
session identity. The exact working-copy path and whether the fork can open
that copy without migration are unresolved and require approval.

## Compatibility facts that must be verified first

Before any setup approval, record evidence for all of the following:

1. Installed official app version, bundle identifier, source/runtime version if
   exposed, and the exact schema/migration level of `/Users/snedmusic/.t3`.
2. Fork commit, package-manager lock state, Node version, desktop dependency
   versions, and whether the fork's current migrations are forward-compatible
   with the snapshot.
3. Whether the fork can open a copied official profile read/write without
   migrating it, and whether its server/desktop protocol can read the user's
   existing projects, threads, approvals, and provider-session records.
4. Whether the official app and fork use different app identities, user-data
   locations, backend ports, and file locks. Different ports alone are not
   sufficient: database ownership and profile paths must also differ.
5. Whether opening the copy changes migrations, projections, attachments,
   activity records, or provider/session runtime state. Any such change must
   be measured and approved before real-state use.
6. The exact supported source launch command for this commit and the required
   Node version. The package script and Operational launcher are evidence of
   repository behavior, not yet a verified user-facing handover command.

Current unresolved facts: source-to-official state compatibility is not
verified; the installed official app's current version and schema are not
verified in this tranche; the approved source launch command for this later
commit is not established; and the safe working-copy path is not chosen.

## One snapshot and restore conditions

The setup operator must create exactly one immutable snapshot of the official
profile while the official instance is quiesced. The snapshot must include the
official database and any profile material proven necessary to reopen the
state. Its exact destination is intentionally unresolved until the user
approves a path with enough free space; the receipt must record the absolute
path, byte size, SHA-256, source profile, source commit/version evidence, and
creation time. Do not create a second timestamped snapshot for retries.

Restore the snapshot, without attempting further fork startup, if any of these
occur:

- the source fork requests or performs an unapproved migration;
- the copied state fails integrity, cannot open, or changes unexpectedly;
- a second T3 owner, backend, database owner, or orphaned process is detected;
- project/thread/session identity, pending approvals, or message history is
  missing or altered;
- Heartbeat behavior is anything other than paused and read-only; or
- the user cannot establish which instance owns the profile.

The existing rollback rule remains authoritative: the official app is opened
only after the Operational/source owner and port have been released. The
existing documented Operational backup is evidence for that separate profile,
not a substitute for the one approved official-profile snapshot.

## Exact handover workflow

### A. Preflight, with no startup

1. Read the current fork commit and dirty-worktree status; do not use a dirty
   checkout as release/build source.
2. Confirm the installed official app and official profile paths from the
   operator's machine evidence. Do not infer versions or schema from a plan.
3. Confirm the user has approved the one snapshot destination and that no
   T3 process, backend listener, or database owner is active.
4. Capture the compatibility facts above and stop on any missing fact.
5. Verify that the fork changes are limited to the approved source/docs slice;
   do not install or package anything.

### B. Official to fork

1. Finish or deliberately leave pending the user's current native turns; do
   not automatically resend them. Record the visible project/thread titles and
   any pending approvals for later comparison.
2. Close the official T3 instance normally. Confirm quiescence using the
   documented profile/database/port ownership checks; a closed window alone is
   insufficient.
3. Create the one immutable snapshot and verify its receipt.
4. Create or designate the fork's working copy only after compatibility is
   approved. The fork must never be pointed at the official live database.
5. Start the source fork only with the exact command approved after the
   unresolved launch-command gate is closed. Record the command, commit,
   profile, database, port, Node version, and startup receipt.

### C. Fork verification with real state

Use only normal native T3 read/send flows. Verify, in order:

1. The Portfolio Control route loads and labels non-migrated VoiceTools data
   honestly.
2. The expected real projects and thread titles are present.
3. At least one known native thread opens through its normal T3 route and its
   recent history is intact.
4. A user-approved test turn, if any, is sent only in the chosen real thread;
   capture the normal native receipt and do not duplicate or resend it.
5. The Heartbeat surface shows paused status, a native thread target selector,
   and no activation, scheduling, persistence, or automatic dispatch.
6. No second official owner, unexpected migration, profile rewrite, or
   unapproved network/runtime action appears in the evidence.

### D. Permitted Heartbeat development/use

During this handover, Heartbeats may be inspected as the current native
Portfolio Control draft only. A target may be selected locally from active
native T3 threads, and the bounded pure model may be reviewed or tested.
Heartbeats may not be enabled, scheduled, persisted, dispatched, polled,
resumed, or used to auto-send turns. Any future activation requires a separate
approval that names the state owner, persistence location, scheduler owner,
normal-turn dispatch path, expiry, stop conditions, and receipt owner.

### E. Fork to official

1. Stop all fork work and record the final project/thread/session and Heartbeat
   evidence. Do not leave a turn or approval in an ambiguous state.
2. Close the fork normally; confirm its backend, database, and process tree are
   gone. If not, enter `ROLLBACK_REQUIRED` and do not open official T3.
3. Confirm the official profile is unchanged except for explicitly approved
   operations; the fork working copy must not be silently promoted.
4. Reopen the official T3 instance only after the single-owner checks are
   clear, then verify the recorded official project/thread titles and history.
5. Record the return receipt. Keep the snapshot and fork evidence until the
   user accepts the result.

## Failure and rollback

At any failure, stop both profiles, preserve logs and receipts, do not retry
with a new database or second snapshot, and enter `ROLLBACK_REQUIRED`. Compare
the working copy against the immutable snapshot and restore only under the
user-approved recovery procedure. If the official profile is uncertain, use
the existing documented rollback gate and keep the official app closed until
ownership is proven clear.

## Evidence receipt

Each transition receipt must contain: operator approval reference; state
transition; fork commit; official app version/schema evidence; Node and package
manager versions; official and fork profile/database paths; ports; process and
database-owner results; snapshot absolute path, size, hash, and timestamp;
projects/threads checked; pending-turn/approval handling; Heartbeat status;
startup/return result; and any unresolved fact. A receipt that omits a fact is
not a handover approval.

## Explicit prohibitions

Do not launch, quit, restart, build, package, install, update, deploy, rename a
session, edit SQLite, migrate real state, create a scheduler, enable a
Heartbeat, poll VoiceTools, call VoiceTools for coordination, resend pending
prompts automatically, or open two T3 instances concurrently under this
design tranche.

## Operator approval checklist

- [ ] I reviewed the fork commit and the installed official version/schema.
- [ ] I approve one immutable official-profile snapshot at a recorded path.
- [ ] I approve the exact fork working-copy path and confirm it is not the
      official live profile.
- [ ] I approve the exact supported source launch command and required Node
      version after they are evidenced.
- [ ] I approve one active T3 instance at a time and the stop-on-uncertainty
      rule.
- [ ] I approve read-only verification against real projects/threads.
- [ ] I understand Heartbeats remain paused, non-persistent, and non-dispatching.
- [ ] I approve the normal return to official T3 only after fork ownership is
      released and verified.

**Exact approval that begins setup:** “I approve the documented preflight and
one-snapshot setup only, after the unresolved compatibility, working-copy, and
supported-launch-command facts are evidenced; no launch or state change is
approved until I separately approve the completed preflight receipt.”
