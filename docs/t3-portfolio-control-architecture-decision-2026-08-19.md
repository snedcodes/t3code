# T3 Portfolio Control — architecture decision

Date: 19 August 2026  
Status: accepted working decision

## Decision

T3 Code is the client and execution foundation for Portfolio Control across the
Mac, Windows laptop, Windows VPS, and mobile app. Each machine runs an
independent T3 execution environment. Desktop, web, and mobile use T3's existing
environment catalog and connection runtime to view and operate those
environments; Portfolio Control must not invent a second cross-machine message
bus.

During migration, the sender and targets may be on mixed T3 release channels:
the Mac may run the source/dev build while the Windows laptop and VPS run alpha
builds. The connection catalog and environment descriptor remain the
compatibility boundary. Native Portfolio dispatch should use the stable
`thread.turn.start` contract and inspect advertised target capabilities; source
running a remote machine is only needed if that proof finds a real contract gap.

Native T3 owns projects, threads, turns, provider execution, interruptions,
receipts, and environment identity. A Portfolio row therefore always carries
an `environmentId` plus the native project/thread identity. Project IDs and
thread IDs are not global across machines.

## Existing T3 remote model

The existing T3 connection layer already supports the required access paths:

- direct LAN or HTTPS pairing;
- Tailscale IP or MagicDNS/HTTPS endpoints;
- T3 Connect relay tunnels for hosts behind NAT or for convenient mobile access;
- desktop-managed SSH launch, which starts or reuses a remote T3 server and
  forwards it locally; and
- saved environments in the desktop/mobile/web connection catalog.

These are access methods to one T3 server, not different Portfolio authorities.
T3 Connect is a managed relay and environment-registration path. Tailscale is
an endpoint provider. SSH is a launch and forwarding helper. None of them is a
Portfolio database, scheduler, transcript store, or replacement messaging
protocol.

Authorized clients are authenticated sessions for an environment. They do not
by themselves create a cross-machine control plane. The Portfolio UI must use
the saved environment catalog and the normal environment-scoped RPC/command
paths to select the target machine and then dispatch through that environment.

## Separate access layers

T3, GitHub, and OpenSSH solve different problems and must not be treated as one
credential system:

- **T3 connections** authenticate an environment for native project, thread,
  turn, and agent-to-agent operations.
- **GitHub user access** authenticates source repositories and inherits the
  user's organization/repository permissions. The current GitHub user is
  `TheVolumeGrid`, associated locally with `thevolumegrid@gmail.com`; that user
  is an active admin of the `snedcodes` organization. Normal development on
  every host therefore uses a write-capable user identity, not a
  repository-specific deploy key.
- **Tailscale plus OpenSSH** provides shell and file access between the
  computers. Tailscale supplies the stable private network path; OpenSSH
  supplies the login, command execution, and forwarding layer.

The source-of-truth rule is consequently simple: GitHub synchronizes source
and documentation, OpenSSH administers the machines, and T3 dispatches native
agent work. A T3 pairing must not be assumed to grant GitHub access, and a
GitHub deploy key must not be treated as a universal host identity.

## Ownership

Native T3 is authoritative for:

- projects and threads;
- provider turns, messages, activity, and token telemetry;
- native interrupt and turn-start commands;
- execution receipts; and
- the identity and reachability of each execution environment.

Portfolio Control is a cross-environment client view over those native records.
It must not copy projects, threads, or sessions into a second Portfolio store.

## Agent-to-agent messaging

Agent-to-agent messaging uses the same native T3 turn path as an ordinary user
message. A sender or Portfolio operator resolves a destination environment and
native thread, acquires that environment through the existing connection
runtime, and dispatches `thread.turn.start` through the target server. The
result is a normal target-thread turn with a native receipt.

Same-machine delivery and remote-machine delivery use the same command contract;
only the connection target differs. The first implementation should expose a
bounded Portfolio dispatch action with explicit target identity,
idempotency, authorization, and accepted/confirmed/uncertain/failed receipts.
VoiceTools target resolution may be used as migration evidence, but it is not
required in the final send path.

Heartbeat records need one explicit owner environment. The initial T3 owner can
be the Mac for proof and migration work; the intended long-lived owner is the
VPS. Owner state must include an owner environment ID, owner epoch, revision,
freshness, and a clear owner-unavailable result. There must be one active
Heartbeat scheduler and one authoritative record set at a time.

VoiceTools is a temporary compatibility source for existing Heartbeat,
Task/Wishlist, and owner records while the native T3 owner seam is being built.
It is not the native messaging transport. No new VoiceTools send gate,
transcript gate, peer registry, or parallel scheduler should be added.

## Heartbeat boundary

The native Heartbeat path is:

```text
T3 owner record
  -> selected environmentId + native threadId
  -> environment-scoped native thread.turn.start
  -> normal T3 provider execution
  -> native turn/timeline receipt
  -> Heartbeat owner receipt and readback
```

The first proof remains paused, bounded, and non-recurring until owner
selection, target resolution, lifecycle, stop conditions, and receipt states
are real. VoiceTools data may be read or imported during migration, but T3 must
not create a second active scheduler beside it.

## Rotations boundary

Rotations is a Portfolio destination separate from the Agents inbox. Its
rotation model is read-only and derives context/token health, native
timestamps, environment labels, and a standards-linked prompt preview from
native T3 data. It must not create successors, perform rotation dispatch,
mutate roles, or perform cutover. A selected row may expose the separate
bounded native-message proof from the Agent-to-agent messaging section; that
ordinary message is not a Rotate action and does not change rotation state.
Later rotation actions must route to a role-resolved native T3 target and
return an explicit receipt.

## What we will not build

- a VoiceTools-based cross-machine transport for native T3 messages;
- a second T3 session or project database;
- a Portfolio scheduler in every environment;
- a hidden global project/thread ID that replaces environment identity;
- a polling fleet or N-per-row transcript hydration loop; or
- automatic Heartbeats, rotation, successor creation, or cutover before the
  owner and receipt contracts are proven.

## Source evidence

- [Remote Architecture](internals/remote.md)
- [Connection Runtime](internals/connection-runtime.md)
- [T3 Connect](internals/t3-connect.md)
- [Remote Access](user/remote-access.md)
- [T3 Portfolio consolidated roadmap](t3-portfolio-consolidated-roadmap-2026-08-17.md)
- [VoiceTools messaging and Portfolio foundation](t3-voicetools-messaging-and-portfolio-foundation-consolidation-2026-08-16.md)
