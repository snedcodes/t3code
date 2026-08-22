# T3 Portfolio Control — execution plan

Date: 19 August 2026  
Status: active work order

Delegation update: 21 August 2026

This is the executable plan. The consolidated roadmap remains the strategic
overview; this document is the sequence we use for implementation and receipts.

## Working rules

Every slice records:

- owner;
- files and contracts;
- dependencies;
- allowed and prohibited actions;
- focused validation;
- receipt required; and
- exact next slice.

The only active Portfolio/Heartbeat owner is the explicitly selected owner
environment. T3 remains the native dispatch path. VoiceTools is a temporary
read/import compatibility source, not a required message transport.

## Source coordination receipt — 21 August

The shared source branch is
`sned/t3-portfolio-control-dev-2026-08-21`, currently anchored at commit
`ce07108b5c73ce4af30cd227b14642fad5dede03`. The Mac source worktree pushed
that commit to GitHub; the VPS and Windows laptop now have real clones of the
same branch. Git is the source/docs coordination layer only. It does not
replicate T3 profiles, projects, threads, provider sessions, or credentials;
those remain host-local under each machine's separate T3 home.

| Host           | Git checkout                                      | Dev T3 home                          | Dev ports           | Lifecycle owner                                    |
| -------------- | ------------------------------------------------- | ------------------------------------ | ------------------- | -------------------------------------------------- |
| Mac            | `/Users/snedmusic/snedcodes/t3-snedcodes-dev`     | explicitly selected live Dev profile | `3773` / web `5840` | existing Mac Dev owner                             |
| Windows VPS    | `C:\Users\Administrator\src\t3-snedcodes-dev-git` | `C:\Users\Administrator\.t3-dev`     | `3774` / web `5733` | Task Scheduler, `T3 Code Source Dev`               |
| Windows laptop | `C:\Users\snedd\src\t3-snedcodes-dev-git`         | `C:\Users\snedd\.t3-dev`             | `3774` / web `5733` | Task Scheduler, `T3 Code Source Dev` at user logon |

Both Windows clones are clean at the shared commit after dependency
installation. The VPS's legacy VoiceTools deploy key remains fetch-only, but
the active source checkout now uses a separate write-capable `TheVolumeGrid`
user key and passes GitHub authentication, fetch, and push dry-run. Do not put
`.t3` state into Git or use Git as a substitute for T3 environment pairing.

## Permanent GitHub/OpenSSH access track — active prerequisite

**Audit receipt, 21 August:** the GitHub login is `TheVolumeGrid`; the local
Git author email is `thevolumegrid@gmail.com`. `TheVolumeGrid` has active
admin membership in the `snedcodes` organization. The Mac can administer the
visible organization repositories and account-owned repositories through that user
identity. The organization is not a second login.

| Host           | GitHub route                                                          | Current result                            |
| -------------- | --------------------------------------------------------------------- | ----------------------------------------- |
| Mac            | `github-t3code-sideband` → `agent_mac_to_three_host_sideband_ed25519` | User authentication and push work         |
| Windows laptop | `github.com` → configured Windows user key                            | Push dry-run works                        |
| Windows VPS    | `github-thevolumegrid-vps-rsa` → `github_thevolumegrid_vps_rsa`       | User authentication and push dry-run work |

The old `github-voicetools-vps` route identifies as
`TheVolumeGrid/VoiceToolsSuite`; it remains available for legacy VoiceTools
uses but is not equivalent to the `TheVolumeGrid` user identity. The active
source checkout now uses `github-thevolumegrid-vps-rsa`, which authenticates as
`TheVolumeGrid`. The VPS still has no authenticated `gh` API session, while the
Mac does; that is optional for Git operations and only needed for GitHub API/PR
work on the VPS.

**Permanent target:** each computer gets a write-capable GitHub user identity for `TheVolumeGrid`,
with normal remotes such as `git@github.com:snedcodes/repository.git`. Deploy keys remain only for
legacy services that genuinely need repository-scoped access. Equal access means
equal GitHub account/org permissions; it does not require copying one private key
between machines.

**Execution sequence:**

1. **Completed 21 August:** register a VPS-specific write-capable
   `TheVolumeGrid` identity, route the source checkout through it, and prove
   `ssh -T`, `git fetch`, and `git push --dry-run`. The old VoiceTools deploy
   key and Alpha runtime were left untouched.
2. Normalize the remotes for active checkouts and run one focused access matrix:
   fetch, branch creation, and dry-run push from Mac, laptop, and VPS. This is
   the Git source-sync proof, not a T3 runtime test.
3. Treat machine access separately over Tailscale plus OpenSSH. The six
   authenticated directions are already proven on 21 August: Mac↔VPS,
   Mac↔laptop, and VPS↔laptop. Windows OpenSSH is automatic and the existing
   stable aliases work. Record that matrix and recheck it only after a host
   reboot or SSH/Tailscale change; do not rebuild a working trust setup.
4. Keep T3 pairing for native agent work. After the access matrix is green,
   record the laptop Dev target-thread message, claim the VPS Dev Heartbeat
   owner, and run the single bounded paused Heartbeat proof.

**Current boundary:** the account/org audit, all-direction OpenSSH proof, and
active VPS source-checkout GitHub write route are complete. The remaining
optional access item is `gh` API authentication on the VPS. The legacy
VoiceTools deploy key remains intentionally unchanged.

**VPS GitHub completion receipt:** a VPS-specific RSA user key was registered
under `TheVolumeGrid`, the active source checkout was switched to
`github-thevolumegrid-vps-rsa`, and `ssh -T`, `git fetch`, and
`git push --dry-run` passed. A separate `gh` login remains optional for API/PR
operations. The old deploy key remains until its remaining VoiceTools use is
confirmed.

## Delegated worker map

The coordinator owns integration, the native transport/Heartbeat contracts,
and truthful cross-machine receipts. Workers have deliberately non-overlapping
scope. A worker is a real, visible T3 project/thread session; the temporary
`VoiceToolsSuite/voicetools/scripts/create_t3_agent_session.py` wrapper may
create that session through the established T3 bridge, but must not become the
message transport for its work.

| Track                       | Owner                                                        | Scope now                                                                                                              | Explicitly out of scope                                                                                | Completion handoff                                                    |
| --------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| Coordination and Heartbeats | Portfolio Control coordinator                                | Slices 2–6: VPS remote receipt, direct initial owner claim, bounded paused proof, later owner-only scheduler           | Rotations implementation, Task ledger duplication, VoiceTools send path                                | Changed files, focused proof, exact owner/readback, next slice        |
| Rotations                   | existing `T3 Portfolio Rotations View Builder 17 AUG` worker | Slices 1 and 7: read-only rows, status, role/standards metadata, later action design only                              | Heartbeat, scheduler, Tasks, owner claim, transport changes, VoiceTools                                | Changed files, focused tests, next read-only/action-preparation slice |
| Tasks discovery             | new `T3 Portfolio Tasks Foundation Builder 21 AUG` worker    | Slice 8 first implementation: contracts and pure compatibility tests for the smallest owner-backed Task/Wishlist model | Server/UI/storage migration, second database, scheduler, VoiceTools transport, Heartbeat-owner changes | Changed files, focused tests, proposed next vertical slice            |

Do not create a separate connectivity worker: the remaining VPS pairing/readback
is a single operator proof on the established native T3 connection path, not a
new architecture track. The Tasks worker may now implement only the narrow
contracts-and-pure-tests slice described in the 21 August handoff; do not let it
cross into server storage, UI, scheduler, transport, or Heartbeat ownership.

Development restart rule: desktop dev now sets
`T3CODE_PRESERVE_PROVIDER_SESSIONS_ON_SHUTDOWN=1`. A server rebuild therefore
keeps resumable provider bindings marked recoverable, and the next server
startup reattaches them before the session reaper begins. Packaged/alpha
shutdown keeps the normal stop-and-mark-stopped behavior. This preserves the
agent session contract across ordinary Mac source rebuilds; it does not claim
that an in-flight provider turn can continue through a hard process kill.

## Slice 0 — preserve the current foundation

**Owner:** T3 source worktree  
**Status:** completed for the focused CLI proof

The native sideband interrupt command in
`apps/server/src/cli/turn.ts` and its registration in `apps/server/src/bin.ts`.
Keep the command on the existing orchestration dispatch contract and make its
receipt truthful for accepted, missing-server, failed, and uncertain cases.

Do not add a second interrupt path or VoiceTools preflight.

**Receipt:** focused CLI tests cover missing runtime state, accepted dispatch,
the emitted interrupt payload, sequence, thread, and turn identity. Server
typecheck passes with pre-existing Effect suggestions only.

**Next slice:** finish the read-only Rotations implementation and the separate
native-message proof already present in the worktree.

## Slice 1 — complete read-only Rotations

**Owner:** T3 web  
**Files:** `apps/web/src/portfolioRotation.ts`,
`apps/web/src/portfolioRotation.test.ts`,
`apps/web/src/components/PortfolioModeNavigation.tsx`  
**Status:** focused implementation and proof complete; visible-client review pending

The current sorting/grouping/preview slice and native-message proof have passed
focused web tests, web typecheck, and diff checks. The paired dev client is
authenticated and the native API can read the real project/thread catalog, but
the controlled preview currently remains on an empty sidebar while the shell
snapshot request is slow; a realistic Electron/web review remains pending.
Keep the
existing limits: native shell data, bounded selected-thread hydration, no
poller, no Portfolio database, no Rotate action, and no role mutation. The
separate selected-row native-message proof is covered by Slice 3; it must not
be presented as rotation execution.

**Receipt:** Rotations is visible, deterministic, and clearly marks missing
telemetry/role/standards data; any native message control is explicitly
separate from rotation state and mutation.

**Next slice:** use the same environment-aware row identity for multi-machine
Portfolio reads and native dispatch.

## Slice 2 — establish the multi-environment Portfolio read surface

**Owner:** T3 client/runtime  
**Dependencies:** existing environment registry, connection supervisor,
desktop/mobile environment catalog, and Slice 1 row model

Verify and then extend the Portfolio read model so every row and action carries
the target `environmentId`, project ID, and thread ID. Use existing connection
targets: direct/bearer, Tailscale, relay, and SSH. Do not add a new transport.

The first useful proof is: Mac Portfolio lists a local environment and at least
one paired remote environment; selecting a remote row opens that remote native
thread; mobile sees the same saved environments through its existing connection
surface.

The current topology is expected to be mixed-version: the Mac sender is the
source/dev build while the Windows laptop and VPS are alpha builds. The proof
must therefore read each target's advertised server version/capabilities and
exercise the stable native `thread.turn.start` contract before considering a
source build on those machines. A mixed version is not itself a blocker.

Local sender receipt: the running Mac dev Electron backend owns port 3773 from
this worktree and advertises server version `0.0.33` and the core
orchestration-compatible capabilities.
Current registration receipt, 21 August: the Mac Dev Connections profile now
has both remote environments saved and connected. Windows laptop
(`DESKTOP-NPBN95R`, environment `0b0b2f55-c599-47a5-bbbd-55a101d1b11d`) and
Windows VPS (`WIN-HOK834JECO0`, environment
`08a3f4cc-bc4d-4cd9-af00-d22dd5d1f14a`) both advertise server `0.0.33`.
The earlier Windows laptop turn/readback remains historical evidence. A fresh
current-profile VPS proof is now complete: Mac sent an ordinary native turn to
`vps-computer-use` / thread
`fa15d90d-b563-4fbb-9d38-404d6787d43a`, accepted as sequence `118516` with
command `765c7e11-d339-46cb-a02a-5c37cedb3ef5`, and read back the target
response. No VoiceTools send path was used.

Historical Source-Dev VPS snapshot receipt, 21 August: the current Mac source worktree was copied
to `C:\Users\Administrator\src\t3-snedcodes-dev` and installed with Vite+
(`vp v0.2.9`, Node 24) without creating an installer. The VPS source instance
uses the separate profile `C:\Users\Administrator\.t3-dev`, listens on
`0.0.0.0:3774`, and serves its development web client on port `5733`. The
existing Alpha owner was left untouched: it continues to use
`C:\Users\Administrator\.t3`, port `3773`, and PID `5568`. The source copy
does not include `.git`; it is a runnable source snapshot, not a second Git
clone. The Dev environment descriptor is
`deb09b61-53a8-4b71-b662-4db4c56c3254`, advertises server `0.0.33` and
`portfolioHeartbeatOwner: true`, and is saved in Mac Dev Connections as a
second environment for `WIN-HOK834JECO0` (the duplicate label distinguishes
the source port/profile from Alpha). Project
`072a6a8f-92f4-464f-8298-5b6e8869f967` points at the source checkout. A
bounded native read-only turn from Mac Dev returned
`T3 Code — C:\\Users\\Administrator\\src\\t3-snedcodes-dev`, proving
Mac-to-VPS source-Dev dispatch and target-thread readback without VoiceTools.

The reproducible Windows source-Dev launch command is:

VPS:

```text
set T3CODE_DEV_ALLOWED_ORIGINS=http://127.0.0.1:5840,http://localhost:5840&& cd /d C:\Users\Administrator\src\t3-snedcodes-dev-git && C:\Users\Administrator\.vite-plus\bin\vp.exe run dev --home-dir C:\Users\Administrator\.t3-dev --host 0.0.0.0 --port 3774
```

Laptop:

```text
set T3CODE_DEV_ALLOWED_ORIGINS=http://127.0.0.1:5840,http://localhost:5840&& cd /d C:\Users\snedd\src\t3-snedcodes-dev-git && C:\Users\snedd\.vite-plus\bin\vp.exe run dev --home-dir C:\Users\snedd\.t3-dev --host 0.0.0.0 --port 3774
```

The origin setting is needed for the current Mac Dev web client on port 5840;
the pairing URL is short-lived and must be freshly generated when reconnecting.

Historical snapshot lifecycle receipt, 21 August: Task Scheduler task `T3 Code
Source Dev` now owns the source instance. Its XML has a `BootTrigger`, runs as
the `Administrator` S4U principal at highest available level, uses
`StartWhenAvailable`, has a three-attempt one-minute restart policy, has no
execution time limit, and ignores duplicate instances. Its action runs from
the source checkout through `cmd.exe`, with output at
`C:\Users\Administrator\.t3-dev\windows-task.log`. After the SSH-attached
runner was stopped, `Start-ScheduledTask -TaskName "T3 Code Source Dev"`
started the new Dev process; the process ancestry terminates at Windows
`Schedule` (`svchost.exe`), not SSH. Port `3774` is owned by the scheduled
source instance while Alpha remains on `3773`/PID `5568`. The task is
configured for reboot startup; a full VPS reboot test has intentionally not
been performed yet. The Mac UI retained both saved remote environments, but
the post-handoff message retry encountered the Mac-side Codex provider health
timeout/remote request interruption; this did not affect the VPS listener,
descriptor, persisted project, or provider-session recovery.

Current Git-backed VPS receipt, 21 August: the active checkout is now the real
clone at `C:\Users\Administrator\src\t3-snedcodes-dev-git` on the shared
branch/commit above. The earlier snapshot at
`C:\Users\Administrator\src\t3-snedcodes-dev` remains preserved as a
backup, but is no longer the active source owner. Task Scheduler task `T3 Code
Source Dev` now runs from the Git checkout against
`C:\Users\Administrator\.t3-dev`, still on `3774`/web `5733`; Alpha
remains separately on `C:\Users\Administrator\.t3`/`3773`. The task is
Windows-owned rather than SSH-attached, and the VPS clone is clean. The
existing Dev project and environment descriptor remain in the separate
`.t3-dev` profile, so moving the source path did not create a second runtime
profile.

Current Git-backed Windows laptop receipt, 21 August: the laptop has a real
clone at `C:\Users\snedd\src\t3-snedcodes-dev-git` on the same
branch/commit. Vite+ (`vp v0.2.9`, Node 24) installed all dependencies. Its
separate Dev profile is `C:\Users\snedd\.t3-dev`, with project
`fab0a76a-28e4-4442-8973-40b46b7ed04b` pointing at the Git checkout. Task
Scheduler task `T3 Code Source Dev` runs as the logged-in `snedd` user at
logon, restarts failed runs, ignores duplicate instances, and owns the source
process independently of SSH. It listens on `0.0.0.0:3774` with web port
`5733`; Alpha remains separately on `3773`. The current environment descriptor
is `6101951d-ebda-453e-96d5-931ba67f684e`, advertises server `0.0.33` and
`portfolioHeartbeatOwner: true`, and is reachable from the Mac over Tailscale
at `100.107.147.25:3774`. A fresh short-lived pairing credential was minted
for the Mac Dev Connections flow but is intentionally not stored in this
durable document. The laptop clone is clean and its GitHub identity passes
`git push --dry-run`.

**Receipt:** environment label, connection state, native identity, and target
selection are visible and truthful across desktop and mobile. The mobile
projection is implemented in `apps/mobile/src/state/portfolioTargets.ts` with
focused tests, and web Rotations rows now carry the existing live connection
presentation alongside their scoped native identity. The visible Rotations T3
worker completed its environment-aware row slice with focused tests and no
VoiceTools or server-owner edits. Both remote environments are now registered
in the current Dev profile, and the current VPS native target-thread readback
is proven. The new laptop source-Dev descriptor is reachable and advertises the
owner capability; it still needs to be added to the Mac Dev Connections profile
and exercised with one fresh target-thread readback. That is an operator pairing
step, not a source-connectivity blocker.

**Next slice:** add the laptop Dev environment through the existing T3
Connections flow, then record one fresh laptop Dev target-thread readback;
native agent-to-agent dispatch itself remains on the existing T3 path.

The mobile Portfolio surface now also lets the operator select an exact native
thread and queue a message through the existing durable thread outbox. This is
the first phone-to-environment dispatch surface; it does not add a Portfolio
transport or bypass the normal T3 connection and delivery path. Opening the
thread still exposes the full native composer for longer work.

## Slice 3 — native agent-to-agent dispatch

**Owner:** T3 client/runtime plus server orchestration  
**Dependencies:** Slice 2 environment catalog and target identity

**Status:** VPS source-Dev native dispatch and target-thread readback complete;
laptop source-Dev reachability proven; laptop fresh readback and remote owner
claim remain

Add the first bounded Portfolio dispatch action. It must accept an explicit
destination `{ environmentId, projectId, threadId }`, connect through the
existing environment supervisor, and issue the native `thread.turn.start`
command on that target environment. Same-machine and remote-machine delivery
must use the same command contract.

The action must return a durable command/idempotency identity and distinguish
accepted, dispatched, transcript-confirmed, confirmation-delayed, uncertain,
and failed outcomes. It must not require VoiceTools inventory, peer health,
status, transcript, or TTS gates before native dispatch.

The local proof supplies a caller-generated `commandId`, a fresh `messageId`,
the explicit environment/project/thread target, and the native dispatch
`sequence` in its accepted receipt. The 21 August Windows proof additionally
supplies a real paired remote target-thread readback. The Portfolio surface now
preserves the native failure tag/message for rejected dispatches, so registry,
unavailable, blocked, transient, schema, and domain failures remain
distinguishable to the operator.

Mixed-version audit result: `compatible_with_caveat`. The dev client does not
gate core `thread.turn.start` on newer optional capabilities, so an alpha target
can be used if it already supports the orchestration dispatch RPC and core turn
start. The first remote proof must send only the compatibility-minimal ordinary
user turn (no bootstrap or newer optional metadata) and surface registered,
unavailable, blocked, transient, schema-incompatible, and domain-rejected
failures distinctly. A committed `sequence` is acceptance; target-thread
stream/readback is the subsequent observation proof.

The first proof is one message from the Mac Portfolio surface to one known
thread on another paired T3 environment, followed by target-thread readback.
The web Portfolio Agents view now exposes the same exact-target composer outside
Rotations, and mobile uses the same saved environment target and dispatch
contract through its durable thread outbox. These are client surfaces over the
same native path, not separate messaging implementations.
Portfolio Host Health also exposes the existing environment catalog's
connection phase, target kind, server descriptor, and optional owner capability
so remote registration gaps are visible before dispatch is attempted.

**Receipt:** the current VPS proof received a normal native T3 turn from Mac and
returned target-thread readback, with no VoiceTools send path involved. The
accepted receipt carried sequence `118516` and command
`765c7e11-d339-46cb-a02a-5c37cedb3ef5`. The existing path was confirmed by
audit:
`environmentCatalog` → `EnvironmentRegistry.run`/`acquireSupervisor` →
`threadEnvironment.startTurn` → `thread.turn.start` → target thread stream
readback. Host Health now lists Mac, Windows laptop, and VPS as connected. The
two Windows alpha targets do **not** advertise `portfolioHeartbeatOwner`, so
the native owner seam cannot yet be claimed on either remote target. The local
web Agents surface is implemented and focused source tests/typecheck pass.

**Next slice:** define the T3 Heartbeat owner descriptor over this proven
environment and dispatch identity.

## Slice 4 — native Portfolio/Heartbeat owner seam

**Owner:** T3 server plus client/runtime  
**Temporary compatibility source:** VoiceTools read/import only

**Status:** authenticated read/claim persistence complete; VPS source Dev is the
epoch-zero owner and its readback is fresh

**Contract foundation:** `packages/contracts/src/portfolio.ts` now defines the
canonical target, owner roles/freshness, typed receipt states, owner epoch and
revision/checksum descriptor, and nullable owner readback. The server now has
authenticated read and claim endpoints backed by
`portfolio-heartbeat-owner.json`; absent or malformed state returns
`owner_unavailable`/`unknown`/`null`. The claim endpoint requires
`orchestration:operate`, serializes competing claims with a server-local
mutex, writes the initial epoch-zero descriptor atomically, and rejects a
different owner or descriptor drift with a conflict. It does not schedule or
transfer live ownership.

**Contract receipt:** focused contract tests cover target branding, nullable
receipt/target fields, owner roles/freshness, and the complete receipt-status
set; the contracts package typecheck passes.

Add the smallest owner descriptor/read contract needed for one owner:

- owner environment ID;
- owner epoch;
- Portfolio and Heartbeat revision/checksum;
- owner, non-owner, and owner-unavailable states;
- freshness and last receipt; and
- canonical target `{ environmentId, projectId, threadId }`.

Do not activate scheduling or duplicate VoiceTools records. A non-owner client
reads the owner state or reports owner-unavailable; it does not silently create
local state.

**Receipt:** the owner service has focused tests for readback, initial atomic
claim persistence, and idempotent repeat claims; the server typecheck passes;
`packages/client-runtime/src/state/portfolioHeartbeatOwnerHttp.ts` provides the
same authenticated read through the existing connection supervisor, with a
focused HTTP-loader test; the web connection runtime provides that loader.
The web Portfolio card now consumes the readback and reports native owner role
and freshness without claiming that Heartbeats are active. The server bundle was
rebuilt through the desktop dev watcher and the live authenticated endpoint
was verified as `owner_unavailable`/`unknown`/`null` because no descriptor is
present.

The shared client runtime also exposes an environment-scoped initial-claim
command through the same connection supervisor. It accepts only the typed
target, revision, and checksum payload supplied by an operator or future
Portfolio form, then refreshes owner readback; it does not derive or fabricate
those values.

For explicit operator initialization, the server CLI now exposes
`portfolio claim-heartbeat-owner` with required target, revision, and checksum
flags. It calls the authenticated running T3 server and prints the resulting
owner readback; it does not write local files offline or silently claim the
current environment. The web Heartbeats view now exposes the same operation as
a manual form: all four revision/checksum values are required, the selected
native target is attached by the client, and the action is disabled for an
older server that does not advertise `portfolioHeartbeatOwner`. Neither path
activates scheduling after a successful claim.

**Completion receipt, 21 August:** the VPS source Dev descriptor was claimed
directly from dated migration evidence with `ownerEpoch: 0`, Portfolio revision
167, Heartbeat revision 1, and the recorded canonical checksums. A subsequent
authenticated owner readback returned `owner / fresh`; no Mac owner was
created, no data was copied, and scheduling remained disabled.

**Next slice:** keep the VPS owner stable while the one bounded native proof is
reconciled below. Do not run a transfer or create a second owner.

## Slice 5 — one paused native Heartbeat proof

**Owner:** selected T3 owner environment  
**Dependencies:** Slice 4 owner seam and native `thread.turn.start`

**Status:** pure lifecycle/receipt model integrated; VPS owner-backed bounded
native proof completed and persisted as transcript-confirmed; scheduler remains
disabled

The pure lifecycle model in `apps/web/src/portfolioHeartbeatLifecycle.ts`
now covers paused/active/stopped/expired/finished states, exact native target
identity, bounded run counts, expiry, finish-line decisions, overlap
prevention, manual pause/stop, terminal-state protection, and all six native
receipt statuses. The paused Heartbeat draft now carries this lifecycle and
the UI reports its paused state/run count. The new
`apps/web/src/portfolioHeartbeatDispatch.ts` preparation seam produces the
exact environment-scoped native `thread.turn.start` payload. Its sender seam
now executes one prepared command through the caller's existing T3 environment
supervisor and maps accepted, failed, and transport-uncertain outcomes into
the shared receipt vocabulary; failed dispatch returns to the paused lifecycle,
while uncertain transport remains active until an operator reconciles it. The
Portfolio card now exposes exactly one owner-gated bounded proof action and an
explicit transcript-confirmation action. Transcript confirmation is written
back through the owning environment's authenticated receipt endpoint with
target matching, idempotency, and stale-receipt rejection; it still does not
schedule.

For operator-side reconciliation, the server CLI also exposes
`portfolio record-heartbeat-receipt`. It accepts the exact command and target
identity plus the typed status (`accepted`, `dispatched`,
`transcript-confirmed`, `confirmation-delayed`, `uncertain`, or `failed`) and
persists it only through the authenticated owner endpoint. It is a receipt
reconciliation tool, not a scheduler or a way to manufacture a successful
turn: use it only with native dispatch/readback evidence for that command.

The current Mac profile has no owner descriptor, so the new action is visibly
disabled with `owner claim required`. This is intentional: the UI does not
invent Portfolio/Heartbeat revisions or checksums to manufacture authority.

The remaining proof must port the existing lifecycle semantics faithfully:
cadence, maximum runs,
expiry, finish line, pause/stop, overlap prevention, target resolution, and
receipts. Start with one non-critical target, one bounded run, an expiry, and a
clear finish line. Keep the Heartbeat paused except for the explicitly bounded
proof, then pause it again.

Delivery must use the normal native T3 turn path. Receipt states must distinguish
accepted, dispatched, transcript-confirmed, confirmation-delayed, uncertain,
and failed.

**Receipt:** one bounded proof has a native turn receipt and owner readback; no
general scheduler is activated.

**Live proof receipt, 21 August:** the VPS source Dev server accepted command
`1d01971b-f221-44f8-9d29-c8c344b4dae1` at native sequence `18` for its exact
registered project/thread target. The target thread completed at
`2026-08-21T08:29:13.779Z` and returned `Idle — no active task or follow-up
work.` The owning server then persisted `transcript-confirmed` with the exact
target and sequence. This proves one native bounded turn plus target-thread
readback; it does not enable a scheduler or migrate the legacy ledger.

**Next slice:** enable only the smallest owner-only scheduler after this proof;
owner transfer remains a later recovery/cutover capability.

## Slice 6 — owner transfer and VPS reachability

**Owner:** T3 connection/runtime plus selected owner

**Status:** staged transfer protocol and client/runtime seam complete; later
recovery/cutover capability, not a prerequisite for initial VPS ownership

`apps/web/src/portfolioHeartbeatOwnerTransfer.ts` models the safe
pause-before-transfer decision, monotonic owner epochs, revision/checksum
continuity, old/new owner roles, duplicate-owner rejection, and typed receipt
statuses. The server/client seam now adds authenticated `prepare`, `accept`,
and `finalize` operations. Prepare persists one continuity ticket; accept
stages the target descriptor; finalize changes the source descriptor to the
new owner and removes the ticket. Every stage requires an explicit paused
assertion and rejects conflicting owners or continuity drift. These operations
do not schedule, dispatch, or resume a Heartbeat. The read-only web adapter
continues to provide a disabled preview over the same model and fails closed
on incomplete identity.

The web surface now shows a disabled owner-transfer preview using explicit
source/target IDs from the native environment catalog. The shared client
runtime exposes the staged transfer commands, while the Mobile connection
runtime also provides the same shared owner loader, and
`apps/mobile/src/state/portfolio.ts` exposes owner readback without creating a
second registry. Mobile Settings now exposes a read-only Portfolio screen that
lists catalog environments, exposes scoped native threads, queues a direct
message to the selected exact thread through the normal durable outbox, opens
the full T3 composer, and reads the selected owner state. Neither surface
enables transfer.

The server CLI now exposes the deliberately operator-driven transfer sequence:

Before any write, inspect each running environment with:

```text
t3 portfolio read-heartbeat-owner --base-dir <t3-home>
```

```text
t3 portfolio prepare-heartbeat-owner-transfer \
  --base-dir <t3-home> \
  --target-owner-environment-id <vps-environment-id> \
  --proposed-owner-epoch <next-epoch> \
  --heartbeats-paused > heartbeat-owner-transfer.json

# run on the target environment after copying the ticket file there
t3 portfolio accept-heartbeat-owner-transfer \
  --base-dir <target-t3-home> \
  --ticket-file heartbeat-owner-transfer.json

# run on the source environment only after target acceptance is confirmed
t3 portfolio finalize-heartbeat-owner-transfer \
  --base-dir <source-t3-home> \
  --ticket-file heartbeat-owner-transfer.json
```

These commands call the authenticated running T3 servers and exchange the
typed ticket; they do not copy databases, start a scheduler, dispatch a
Heartbeat, or resume one. No live transfer has been run. The immediate next
action is to establish the initial owner and run the bounded proof. Use this
sequence later only when a real existing owner must move to another environment.

`apps/server/src/portfolio/PortfolioHeartbeatOwnerClaim.ts` provides the
server-side pure claim decision: initial claims create epoch-zero canonical
descriptors, matching repeats are idempotent, and competing or drifting claims
are rejected. `apps/server/src/portfolio/http.ts` wraps that decision in the
authenticated `POST /api/portfolio/heartbeat-owner/claim` operation, and the
owner service persists accepted initial claims atomically. This is an
owner-claim seam, not live Mac-to-VPS transfer or scheduling.

Use the existing saved-environment and access paths to prove Mac-to-VPS
ownership transfer. T3 Connect or Tailscale may provide reachability; neither
becomes the owner database or scheduler. Pause Heartbeats, prepare the ticket,
accept it on the VPS, finalize the Mac descriptor, verify the revision/checksum
and owner epoch, and resume only after the new owner is confirmed. The current
source has not executed this sequence against a real remote target.

**Receipt:** old owner is paused, new owner is identified, no overlap occurred,
and clients reconnect to the new owner.

**Next slice:** after the owner-backed paused proof, enable a small
owner-only scheduler; use this transfer protocol only for later migration or
recovery.

## Slice 7 — rotation authority and later action

**Owner:** T3 Portfolio/role contract

**Status:** read-only authority model and UI metadata integrated; Rotate and
cutover actions remain deliberately disabled

`apps/web/src/portfolioRotationAuthority.ts` resolves the existing row's
scoped worker identity, role availability, standards links, prompt version, and
explicit disabled action policy. The Rotations detail view consumes that model
without creating a successor, changing a role, or dispatching a Rotate action.

Add a read-only role/standards resolver for the current rotation worker. Keep
the preview versioned and standards-linked. Only after owner and receipt
contracts are proven should a `Rotate` action be designed; it must dispatch to a
resolved native target with an idempotency key and explicit receipt.

No automatic successor creation, archive, rename, handoff, or cutover belongs in
the first action slice.

## Slice 8 — Tasks, Wishlist, and VoiceTools retirement

After Heartbeat owner/readback is stable, expose Tasks and Wishlist through the
same owner contract without copying the ledger into a second T3 database.
Migrate existing VoiceTools records deliberately, then remove VoiceTools from
the native messaging path. The Realtime Assistant remains later work and should
read explicit T3 APIs when it is eventually integrated.

**Discovery receipt, 21 August:** the visible Tasks worker proposed a schema-only
first slice: branded `taskId`, title/outcome, exact native target, legacy task
status, priority/assignment, checklist items, completion condition, links,
timestamps, monotonic revision, nullable native receipt, and optional Heartbeat
binding. Task status remains separate from receipt status. Legacy records with
no unambiguous `{environmentId, projectId, threadId}` remain unresolved and
read-only; no IDs are inferred. The VPS owner capability and one native
transcript-confirmed proof are now available, so the worker is authorized to
implement only the contracts and pure compatibility tests in that proposal.

## Current next three actions

1. Let the Tasks worker complete the narrow contracts-and-pure-tests slice;
   review its receipt and integrate it without crossing the scope boundary.
2. Implement and focus-test the smallest owner-only scheduler seam, keeping it
   disabled by default and requiring the existing fresh owner/readback contract.
3. Complete the fresh laptop Dev target-thread readback, then prepare the next
   Tasks/Wishlist vertical slice and only later test an explicit owner transfer.

## References

- [Architecture decision](t3-portfolio-control-architecture-decision-2026-08-19.md)
- [Current work index](t3-portfolio-control-current-work-index-2026-08-17.md)
- [Consolidated roadmap](t3-portfolio-consolidated-roadmap-2026-08-17.md)
- [Rotations ordering plan](t3-portfolio-rotations-ordering-plan-2026-08-17.md)
- [Remote Architecture](internals/remote.md)
- [Remote Access](user/remote-access.md)
