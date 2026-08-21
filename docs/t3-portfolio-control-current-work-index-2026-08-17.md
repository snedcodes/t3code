# T3 Portfolio Control — focused document index

Updated: 21 August 2026  
Purpose: one compact reading and execution index for the current Portfolio
Control build.

## Overall build plan

T3 is the execution and cross-machine control foundation. Each computer is an
independent T3 environment. The existing T3 connection runtime, environment
catalog, Tailscale support, T3 Connect relay, and SSH launch paths provide
reachability. Native T3 dispatches turns to the selected environment and
thread.

VoiceTools is temporary migration/readback compatibility for existing Portfolio
and Heartbeat records. It is not the final messaging transport and must not
become a second scheduler, session registry, or Portfolio database.

Permanent computer access is a separate prerequisite: the GitHub user
`TheVolumeGrid` is the active admin of the `snedcodes` organization, GitHub
syncs source/docs, OpenSSH over Tailscale administers the computers, and T3
dispatches native agent work. The six machine-SSH directions are now proven,
and the active VPS source checkout now uses a write-capable
`TheVolumeGrid` GitHub identity. The old read-only VoiceTools deploy-key route
is retained only for legacy VoiceTools uses. The execution plan's
**Permanent GitHub/OpenSSH access track** is the authoritative order for
remaining repository cleanup and the transition back to Heartbeat work.

The build sequence is:

1. Keep the native interruption and read-only Rotations foundation intact.
2. Prove native agent-to-agent dispatch across one registered remote
   environment.
3. Use the read-only Heartbeat owner seam and paused lifecycle for one bounded
   proof.
4. Establish the VPS as the direct initial owner, run one paused proof, and
   retain owner transfer only for later recovery or cutover.
5. Add reviewed rotation actions, then migrate Tasks/Wishlist and retire the
   remaining VoiceTools messaging dependency.

## How to use this index

Read the architecture decision first to understand the boundaries. Use the
execution plan as the active work order: complete one slice, record its receipt,
and then take only the stated next slice. Use the focused evidence documents
when implementing the corresponding slice; do not reopen the older strategic
plans unless a decision or source contract needs checking.

## 1. Decisions and active work order

- [Portfolio Control architecture decision](t3-portfolio-control-architecture-decision-2026-08-19.md) — settles T3 environment identity, T3 Connect/Tailscale/SSH roles, native agent-to-agent dispatch, Heartbeat ownership, and the VoiceTools boundary.
- [Portfolio Control execution plan](t3-portfolio-control-execution-plan-2026-08-19.md) — the slice-by-slice implementation sequence, dependencies, prohibitions, validations, and receipts.
  Its **Delegated worker map** is the authoritative division between the
  coordinator, the existing Rotations worker, and the read-only Tasks discovery
  worker.
- [Consolidated Portfolio roadmap](t3-portfolio-consolidated-roadmap-2026-08-17.md) — strategic context, achieved foundation, Heartbeat direction, Rotations direction, and long-term prohibitions.

## 2. Native messaging and Rotations

- [T3/VoiceTools messaging and Portfolio foundation](t3-voicetools-messaging-and-portfolio-foundation-consolidation-2026-08-16.md) — source-traced native `thread.turn.start`, `/api/orchestration/dispatch`, exact target identity, receipt states, and the compatibility boundary. Use as evidence, not as the final VoiceTools architecture.
- [Rotations ordering plan](t3-portfolio-rotations-ordering-plan-2026-08-17.md) — the current read-only Rotations slice: sorting, grouping, telemetry boundaries, prompt preview, authority metadata, and explicit non-goals.
- Native Heartbeat seams — `apps/server/src/portfolio/`, `apps/server/src/cli/portfolio.ts`, `packages/client-runtime/src/state/portfolio.ts`, `apps/web/src/portfolioHeartbeatLifecycle.ts`, `apps/web/src/portfolioHeartbeatDispatch.ts`, and `apps/web/src/portfolioHeartbeatOwnerTransfer.ts` provide the authenticated owner read/initial-claim contract, explicit CLI and web operator claim paths, environment-scoped client claim and receipt commands, paused lifecycle, owner-gated one-proof dispatch, durable transcript receipt readback, staged prepare/accept/finalize transfer commands, and a disabled transfer preview. They do not activate a scheduler or execute a live remote transfer.
- Native agent messaging surfaces — web Portfolio Agents and Rotations use the existing environment-scoped `thread.turn.start` command with exact `{environmentId, projectId, threadId}` identity; mobile uses the same selected target through its durable thread outbox. Neither surface uses VoiceTools as a transport.
- Native environment readiness — web Portfolio Host Health now lists each registered environment's connection phase, target kind, platform/server descriptor, and optional Heartbeat-owner capability; it does not infer peer health or create a second registry.

## 3. Multi-environment T3 capability

- [Remote Architecture](internals/remote.md) — execution environments, environment IDs, saved targets, direct access, T3 Connect relay, Tailscale, and SSH.
- [Connection Runtime](internals/connection-runtime.md) — environment registry, supervisors, reconnection, scoped RPC, and per-environment cached state.
- [Remote Access](user/remote-access.md) — practical desktop, mobile, Tailscale, T3 Connect, pairing, and SSH launch workflows.
- Mobile target projection — `apps/mobile/src/state/portfolioTargets.ts` keeps environment ID, label, connection state, and explicit primary/relay/bearer/SSH identity together; `apps/mobile/src/state/portfolio.ts` and `apps/mobile/src/features/portfolio/PortfolioRouteScreen.tsx` expose owner readback, scoped native thread selection, direct durable-outbox messaging to the selected thread, and links that open the existing full T3 composer.

The confirmed native dispatch chain is `environmentCatalog` →
`EnvironmentRegistry.run`/`acquireSupervisor` → `threadEnvironment.startTurn` →
native `thread.turn.start` → target-thread stream readback. The current Mac Dev
profile now has both Windows remotes saved and connected, and a real VPS
target-thread proof has completed without VoiceTools. A fresh Windows laptop
readback remains optional; the next substantive blocker is that the alpha
Windows targets do not advertise the native `portfolioHeartbeatOwner`
capability required for VPS owner claim.

## 4. Temporary Heartbeat source evidence

- [VoiceTools Portfolio/Heartbeat port map](voicetools-portfolio-heartbeat-port-map-2026-08-15.md) — the existing Heartbeat, Portfolio ledger, owner, and receipt behavior being migrated. Consult this only when preserving an existing contract during the native T3 port.

## Finish line

The capability is ready for normal use when a Portfolio user can select a
known target environment and native thread from Mac or mobile, send a bounded
message through T3, receive a truthful native receipt, view the target-thread
readback, and later run one owner-backed paused Heartbeat through the same path.
Automatic scheduling, rotation/cutover, and VoiceTools retirement come only
after those proofs are complete.
