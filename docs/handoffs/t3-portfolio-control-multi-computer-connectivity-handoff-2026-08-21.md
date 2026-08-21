# T3 Portfolio Control — Multi-Computer Connectivity Handoff

Date: 21 August 2026
Status: verified connectivity foundation; Heartbeat and Tasks remain in
implementation
Source repository: `/Users/snedmusic/snedcodes/t3-snedcodes-dev`
Shared branch: `sned/t3-portfolio-control-dev-2026-08-21`
Latest source/documentation commit: `473017d49`

## Purpose

This handoff records the durable operating model and the evidence established
while moving Portfolio Control away from VoiceTools transport and toward native
T3 multi-environment operation. It is intended to let a successor recover the
setup after a reboot, broken connection, Git drift, T3 crash, or agent handoff
without guessing routes or recreating the architecture.

It is a product-specific evidence and recovery document. The reusable policy
owner is the Agents Dev Guidelines repository; this document does not silently
replace either repository's `AGENTS.md`.

## Read first

1. [T3 Portfolio Control architecture decision](../t3-portfolio-control-architecture-decision-2026-08-19.md)
2. [T3 Portfolio Control execution plan](../t3-portfolio-control-execution-plan-2026-08-19.md)
3. [Focused Portfolio Control index](../t3-portfolio-control-current-work-index-2026-08-17.md)
4. The live repository [`AGENTS.md`](../../AGENTS.md)
5. The central coordinator handoff in the Agents Dev Guidelines repository:
   `/Users/snedmusic/snedcodes/agents-dev-guidelines/agent_roles/handoffs/agents-dev-guidelines-coordinator/2026-08-21_t3_portfolio_control_multi_computer_connectivity_handoff.md`

## Executive result

The three connectivity layers are now separated and working:

| Layer               | Owner                                             | What it does                                                                 | What it does not do                                         |
| ------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Native T3           | T3 server/environment and selected project/thread | Sends normal agent turns to an exact remote environment, project, and thread | It does not grant GitHub or shell access                    |
| GitHub              | `TheVolumeGrid` user and `snedcodes` organization | Synchronizes source and documentation across clones                          | It does not own T3 profiles, databases, or running services |
| Tailscale + OpenSSH | Each host's network and service owner             | Provides stable machine-to-machine shell access                              | SSH is transport, not a durable service owner               |

VoiceTools remains useful for live Passport/session discovery, authoritative
transcript readback, visible-agent creation, phone alerts, and migration
evidence. It is not the intended transport for ordinary native T3 agent
messages and must not become a second scheduler, session registry, or Portfolio
database.

## Verified source and runtime topology

### Mac

- Source checkout: `/Users/snedmusic/snedcodes/t3-snedcodes-dev`
- Branch: `sned/t3-portfolio-control-dev-2026-08-21`
- Latest verified commit: `473017d49`
- Dev T3 profile: explicitly selected real profile under `/Users/snedmusic/.t3`
- Dev server port: `3773`
- Dev web port: `5840`
- This is the active source-development owner during the present tranche.
- Do not start a second T3 owner against the same live profile.

### Windows VPS

- Host identity: `WIN-HOK834JECO0`
- Active source checkout:
  `C:\Users\Administrator\src\t3-snedcodes-dev-git`
- Dev T3 profile: `C:\Users\Administrator\.t3-dev`
- Source Dev port: `3774`
- Source Dev web port: `5733`
- Lifecycle owner: Windows Task Scheduler task `T3 Code Source Dev`
- Alpha remains separate on `C:\Users\Administrator\.t3`, port `3773`.
- The old snapshot `C:\Users\Administrator\src\t3-snedcodes-dev` is preserved
  as a backup and is not the active source owner.
- The active source descriptor reported server `0.0.33` and
  `portfolioHeartbeatOwner: true`.
- Tailscale address used during the proof: `100.118.254.22`.

### Windows laptop

- Host identity: `DESKTOP-NPBN95R`
- Active source checkout: `C:\Users\snedd\src\t3-snedcodes-dev-git`
- Dev T3 profile: `C:\Users\snedd\.t3-dev`
- Source Dev port: `3774`
- Source Dev web port: `5733`
- Lifecycle owner: Windows Task Scheduler task `T3 Code Source Dev` at user
  logon
- Alpha remains separate on port `3773`.
- The active source descriptor reported server `0.0.33` and
  `portfolioHeartbeatOwner: true`.
- Tailscale address used during the proof: `100.107.147.25`.

The duplicate display name `DESKTOP-NPBN95R` in the Mac Connections list is a
label problem, not an identity collision. T3 routes by environment identity,
project, thread, profile, and port. Keep the environments separate and label
them as VPS Dev, laptop Dev, VPS Alpha, or laptop Alpha when the UI permits.

## GitHub standard and current proof

The GitHub login is `TheVolumeGrid`. `thevolumegrid@gmail.com` is the account
email and local commit identity; it is not a second GitHub login. `snedcodes` is
an organization administered by that user. A key registered to
`TheVolumeGrid` inherits the user's accessible account and organization/repo
permissions.

### Active routes

| Host           | Active GitHub route                                                       | Proof                                  |
| -------------- | ------------------------------------------------------------------------- | -------------------------------------- |
| Mac            | `github-t3code-sideband` using `agent_mac_to_three_host_sideband_ed25519` | User authentication and push work      |
| Windows laptop | `github.com` using its configured user key                                | Push dry-run works                     |
| Windows VPS    | `github-thevolumegrid-vps-rsa` using `github_thevolumegrid_vps_rsa`       | `ssh -T`, fetch, and push dry-run work |

The active VPS RSA key is stored at:

```text
C:\Users\Administrator\.ssh\github_thevolumegrid_vps_rsa
```

Its fingerprint is:

```text
SHA256:BIlf/a/VhzLsYIoUDOBAC9Rim1R6aADJubPjSmHkzIQ
```

The VPS source remote is:

```text
git@github-thevolumegrid-vps-rsa:snedcodes/t3code.git
```

The old `github-voicetools-vps` alias and its repository-scoped
`voicetools_github_deploy_ed25519` key remain in place for legacy VoiceTools
uses. Do not delete or repoint that alias without auditing its remaining
repositories first. The first VPS Ed25519 user key was also registered, but the
old Windows OpenSSH client could not complete its signing operation; the RSA
route is the active compatible route.

Git synchronizes source and documentation only. T3 homes, databases, provider
state, receipts, and credentials remain host-local and must not be put into
Git.

### VPS Git recovery

From the VPS source checkout:

```powershell
cd C:\Users\Administrator\src\t3-snedcodes-dev-git
git status --short
git branch --show-current
git remote -v
git pull --ff-only origin sned/t3-portfolio-control-dev-2026-08-21
git push
```

Expected source remote host: `github-thevolumegrid-vps-rsa`. If it is wrong,
inspect the repo-local remote before changing it. Do not use a broad remote
rewrite across unrelated repositories.

The VPS does not currently have a `gh` API login. That is optional for normal
clone, fetch, pull, and push. Add a separate `gh` login only if the VPS must
create PRs, inspect issues, or perform other GitHub API actions.

## Tailscale and OpenSSH standard

Tailscale is the private network path. OpenSSH authenticates the machine login
and executes commands. The following six authenticated directions were
actually proven, not inferred from a port scan:

| Direction    | Stable alias       | Result                           |
| ------------ | ------------------ | -------------------------------- |
| Mac → VPS    | `agent-win-vps`    | authenticated `whoami`           |
| Mac → laptop | `agent-win-laptop` | authenticated and used for setup |
| VPS → Mac    | `agent-macbook`    | authenticated `whoami`           |
| VPS → laptop | `agent-win-laptop` | authenticated `whoami`           |
| laptop → Mac | `agent-macbook`    | authenticated `whoami`           |
| laptop → VPS | `agent-win-vps`    | authenticated `whoami`           |

Windows `sshd` is running with automatic startup on both Windows hosts. The
Mac and Windows hosts retain their existing Tailscale/OpenSSH configuration.
Do not rebuild this trust setup merely because a T3 pairing or GitHub check
fails; they are separate layers.

SSH is only transport. A long-running T3 server, watcher, tunnel, or backend
must remain owned by Task Scheduler, the T3 desktop lifecycle, or another
documented host-local service manager. Do not launch a durable service as an
unmanaged child of an interactive SSH session.

## Native T3 connection standard

Each computer is an independent T3 execution environment. The Mac Dev client
stores remote environments through the normal T3 Connections flow. A remote
target is selected by exact environment identity, project, and thread. The
normal message path is the existing native T3 turn/dispatch path, not a
VoiceTools relay.

For ordinary cross-agent work:

1. Confirm the target environment is connected and the target project/thread
   exists.
2. Select the exact environment, project, and thread.
3. Send one normal native T3 turn.
4. Retain the dispatch/turn receipt and read back the receiving thread.
5. Treat delivered, acknowledged, and substantively completed as separate
   states.

If a visible coordinator or worker must be contacted through the established
VoiceTools-owned sender, use the exact visible title and exact project. Do not
guess a raw thread ID, construct a route alias, use direct SQLite, open T3
Chat, or fall back to a hidden sub-agent. A title-resolution failure is a
discovery failure, not permission to recreate or rename the session.

## What was built and what remains

### Completed

- Mac Dev, VPS Dev, and laptop Dev source paths were separated from Alpha.
- VPS and laptop now have real Git clones of the shared source branch.
- Windows Dev instances are owned by Task Scheduler, not an SSH terminal.
- Mac can reach and message Windows agents through native T3.
- Native Portfolio Agents/Rotations messaging uses exact environment/project/
  thread identity and `thread.turn.start`-style native dispatch.
- Host Health exposes registered T3 environment and capability information.
- Heartbeat owner readback, initial claim, receipt persistence, idempotency,
  stale-receipt protection, and staged paused transfer contracts exist in
  source.
- GitHub user access and all six machine-SSH directions are proven.

### Not complete

- No owner-backed bounded Heartbeat proof has been run end to end.
- No recurring Heartbeat scheduler is enabled.
- The VPS has not yet been made the live Heartbeat owner through the intended
  owner claim/proof sequence.
- Tasks and Wishlist are not yet the complete native owner-backed system.
- Rotations remains primarily a read-only view; dispatch, handoff, and cutover
  automation are later slices.
- `gh` API authentication on the VPS is optional and not configured.
- VoiceTools retirement is not complete; its useful migration/readback and
  visible-session capabilities remain intentionally available.

## Recovery rules after a failure

### If Git fails on the VPS

1. Confirm the active repo path and `git status --short`.
2. Confirm the remote is `github-thevolumegrid-vps-rsa`, not the legacy deploy
   alias.
3. Run `ssh -T github-thevolumegrid-vps-rsa` from the VPS.
4. Run `git fetch` before changing branches or remotes.
5. Preserve dirty work; do not reset, clean, or overwrite it.

### If a T3 Dev instance fails

1. Do not kill by process-name pattern and do not restart Alpha automatically.
2. Identify the owning host, profile, port, and lifecycle owner.
3. Check the owner-controlled service or Task Scheduler task.
4. Confirm only one process owns that profile and port.
5. Preserve the profile and database; do not create a clone profile unless the
   user explicitly chooses isolation.

### If remote T3 pairing fails

Check, in order: T3 server owner, Tailscale reachability, listening port,
environment descriptor, saved environment identity, and pairing credential.
Do not infer a GitHub or SSH failure from a T3 pairing error.

## Coordinator request

The Agents Dev Guidelines Coordinator should read this handoff and the three
linked T3 Portfolio Control documents, then:

1. classify which parts are reusable standards and which are T3-local facts;
2. preserve the ownership split between T3, GitHub, Tailscale/OpenSSH,
   VoiceTools, Mac-Win Agent Remote, and the target repository;
3. create or update one dated central handoff/standard in
   `agents-dev-guidelines` for the proven multi-computer source and native-T3
   coordination pattern;
4. add current pointers, changelog, and trajectory evidence without editing
   target `AGENTS.md` files automatically;
5. return an adoption matrix for T3, VoiceTools, and Mac-Win Agent Remote;
6. report exactly three next actions, with any live-session or credential
   action kept behind its own explicit authority boundary.

The central repo must not turn these host-specific paths, ports, fingerprints,
or environment IDs into universal policy. It should extract the reusable
invariants and keep the concrete values as evidence in this handoff.

## Evidence and limitations

- Source/documentation commit: `473017d49` on the shared branch.
- The current T3 execution plan is the detailed implementation ledger; some
  older slice paragraphs describe pre-21-August state and should be read in
  chronological order against the latest access receipt.
- T3 transcript statements are coordination context, not filesystem or runtime
  proof. The host/Git/SSH facts in this document come from the corresponding
  commands and receipts on 21 August.
- No private key, GitHub token, pairing URL, provider credential, or raw
  database content belongs in this handoff.
