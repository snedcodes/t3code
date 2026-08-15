# Using the T3 source fork safely

Status: design only. This document does not start, stop, or change T3.

## What this plan is for

This plan explains how to try the Mac source fork with the user's real T3
projects, threads, and session history without running two T3 instances at the
same time.

The fork's current Portfolio Control page is only a view. It reads native T3
thread state. Heartbeats are paused, local, and read-only. They do not run or
send turns.

## What this plan does not do

- It does not launch, quit, restart, build, package, install, update, or deploy
  anything.
- It does not edit the official T3 database or migrate real data.
- It does not rename sessions, resend prompts, or activate Heartbeats.
- It does not add a database, poller, scheduler, broker, or VoiceTools bridge.

## Facts we have

These paths and settings are documented in the repository:

| Use                                  | Profile                            | Database                                                 | Backend port |
| ------------------------------------ | ---------------------------------- | -------------------------------------------------------- | ------------ |
| Official T3 Nightly                  | `/Users/snedmusic/.t3`             | `/Users/snedmusic/.t3/userdata/state.sqlite`             | `3773`       |
| Source-backed Operational experiment | `/Users/snedmusic/.t3-operational` | `/Users/snedmusic/.t3-operational/userdata/state.sqlite` | `3774`       |

The official app is documented at `/Applications/T3 Code (Nightly).app`.
The source checkout is `/Users/snedmusic/snedcodes/t3code`.

The repository defines this development script:

```text
node scripts/dev-runner.ts dev:desktop
```

The Operational launcher adds a profile, port, and web URL, and checks for
Node 24. That launcher is an experiment, not proof that it is the approved
daily source-fork launch method.

The current host profile names commit
`9df4b305a28190018075655a452e448a8897d733` as build source. This checkout is
newer, so the host profile does not approve the current checkout for a build.

The current Portfolio Control work is in [Plan 30](../.plans/30-portfolio-control-draft-workspace.md).
The fork/release rules are in [Plan 27](../.plans/27-t3-fork-portfolio-and-rolling-release-plan.md).
The host profile is [here](../../agents-dev-guidelines/DOCS/OPERATIONS/HOST_PROFILES/T3CODE_2026-08-14.md).

## The one-instance rule

Only one T3 instance may own the working profile at a time.

| State            | Meaning                                                                                        |
| ---------------- | ---------------------------------------------------------------------------------------------- |
| Official active  | The installed official app owns the official profile. The fork stays closed.                   |
| Ready to switch  | Official T3 is closed, its database is not open, and its backend is not listening.             |
| Fork active      | The fork owns a separate approved working copy. Official T3 stays closed.                      |
| Ready to return  | The fork is closed, its database is not open, and its backend is not listening.                |
| Stop and recover | Ownership, compatibility, or data integrity is unclear. Do not open either app until resolved. |

Different ports are not enough. The profile path, database owner, and process
tree must also be different.

## The one snapshot

Before the fork uses real T3 state, make one read-only snapshot of the official
profile while official T3 is closed. Keep it until the user accepts the test.

The exact snapshot location is not chosen yet. The setup receipt must record:

- absolute path;
- source profile and database;
- file size and SHA-256;
- creation time; and
- official app version and schema evidence.

Do not create a new snapshot for every retry.

Restore the snapshot and stop if the fork asks for an unapproved migration,
cannot open the copied state, changes projects or messages, creates a second
owner, or shows any Heartbeat activity.

The existing [Operational rollback guidance](../scripts/T3%20Operational%20Rollback.md)
still applies. Its existing Operational backup is not a replacement for this
official-profile snapshot.

## What must be checked first

Before any real-state test, check:

1. The installed official app version and database schema.
2. The fork commit, lockfile, Node version, and desktop dependencies.
3. Whether the fork can read a copy of the official profile without migration.
4. Whether projects, threads, messages, approvals, and provider sessions open
   correctly in that copy.
5. The exact source launch command supported by this fork commit.
6. The profile paths, ports, file locks, and process owners for both apps.

These facts are not all known yet. In particular, source-to-official
compatibility, the current installed version/schema, the safe working-copy
path, and the supported source launch command still need evidence.

## Normal switch: official T3 to the fork

1. Note the projects and threads that matter, including any pending approvals.
   Do not resend anything automatically.
2. Close official T3 normally.
3. Confirm its profile database and backend are no longer in use.
4. Make the one snapshot.
5. Use a separate working copy of that snapshot for the fork. Never point the
   fork at the live official database.
6. Start the fork only after its supported launch command and Node version are
   confirmed.
7. Record the fork commit, profile, database, port, and startup result.

## Check the fork with real sessions

Use normal T3 screens only:

1. Open Portfolio Control.
2. Confirm the expected native projects and thread titles are present.
3. Open a known thread and check its recent messages.
4. If a test turn is needed, send one user-approved turn in that real thread.
   Record its normal T3 receipt. Do not resend it.
5. Check that Heartbeats say **Paused** and have no run, enable, schedule, or
   automatic-send control.
6. Stop if the fork migrates, rewrites, loses, or unexpectedly changes data.

## What Heartbeats may do here

They may show the paused native model and let the user select an existing
active native T3 thread locally. They may not persist a schedule, poll, wake a
thread, dispatch a turn, activate, resume, or call VoiceTools.

## Normal return: fork to official T3

1. Finish the check and record what was viewed or changed.
2. Close the fork.
3. Confirm its database, backend, and process tree are gone.
4. Confirm the official profile was not changed by the fork.
5. Open official T3 and check the recorded projects and threads.
6. Keep the snapshot until the user accepts the result.

If the fork does not close cleanly, do not open official T3. Stop and use the
snapshot/recovery path.

## Failure and recovery

Stop when any of these is unclear:

- which app owns the database;
- whether a process is still running;
- whether a migration happened;
- whether messages, approvals, or sessions changed; or
- whether a Heartbeat ran.

Keep the logs and receipt. Do not retry against the official database. Compare
the working copy with the one snapshot and restore only through the approved
recovery process.

## What the receipt should say

Record the date, fork commit, official app/version evidence, Node version,
profile and database paths, ports, process-owner checks, snapshot hash,
projects and threads checked, pending approvals, Heartbeat status, result, and
anything still unknown.

## Simple operator checklist

- [ ] Official T3 version and schema are recorded.
- [ ] The current fork commit and Node requirement are recorded.
- [ ] One snapshot location is chosen and verified.
- [ ] The fork working copy is separate from the official live profile.
- [ ] The supported source launch command is confirmed.
- [ ] Only one T3 instance will run at a time.
- [ ] Real projects and threads will be checked through normal T3 screens.
- [ ] Heartbeats will stay paused and read-only.
- [ ] The fork will be closed and checked before official T3 is reopened.

For the next step, the user only needs to say: **start the read-only
preflight**. That preflight will report what is known and will not launch or
change T3.
