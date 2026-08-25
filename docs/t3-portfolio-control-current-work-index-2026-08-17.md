# T3 Portfolio Control — focused document index

Updated: 24 August 2026
Purpose: one compact reading and execution index for the current Portfolio
Control build.

## Current authority

Start with the [Native Messaging, Session Health, Portfolio, and VoiceTools Retirement Plan](t3-native-messaging-portfolio-consolidation-plan-2026-08-23.md).
It is the authoritative operating model and checklist. It reconciles Alpha and
Dev profiles, native fleet messaging, context/session/storage health,
VPS-first source development, unfinished Portfolio work, and staged VoiceTools
retirement. Older roadmaps remain source evidence where they do not conflict
with it.

## Overall build plan

T3 is the execution and cross-machine control foundation. Each computer is an
independent T3 environment. The existing T3 connection runtime, environment
catalog, Tailscale support, T3 Connect relay, and SSH launch paths provide
reachability. Native T3 dispatches turns to the selected environment and
thread.

VoiceTools is temporary migration/readback compatibility for existing Portfolio
and Heartbeat records. It is not the final messaging transport and must not
become a second scheduler, session registry, or Portfolio database.

Permanent computer access is a separate supporting layer: the GitHub user
`TheVolumeGrid` is the active admin of the `snedcodes` organization, GitHub
syncs source/docs, OpenSSH over Tailscale administers the computers, and T3
dispatches native agent work. The six machine-SSH directions are now proven,
and the active VPS source checkout now uses a write-capable
`TheVolumeGrid` GitHub identity. The old read-only VoiceTools deploy-key route
is retained only for legacy VoiceTools uses. Use the connectivity handoff for
repair evidence if this layer breaks; it is not a prerequisite track for the
current native messaging work.

The reconciled build sequence is:

1. Use the completed VPS-owned manual Heartbeat receipt plus the laptop reverse
   receipt to remove
   VoiceTools from ordinary messaging: retain required voice/data capability,
   reject new VoiceTools message dispatch, then update the central and
   repository agent guidance together.
2. Add Heartbeat scheduling only after the manual record remains visible,
   pausable, and trustworthy.
3. Finish a native Tasks/Wishlist vertical slice, then bounded Rotations work.
4. Continue Dev stability and Storage Health independently; neither blocks the
   first manual Heartbeat or VoiceTools messaging retirement.

## How to use this index

Read the consolidation plan first and work its checklist from top to bottom.
Read the architecture decision for boundaries and the focused evidence
documents only for the slice being implemented. The older execution plan is a
receipt ledger and implementation reference, not the current operating order.

## Current coordinator focus

Heartbeats and VoiceTools messaging retirement are the active programme focus.
The manual VPS record has sent once to an exact Alpha target through
`thread.turn.start`; target readback and the VPS-persisted receipt are present.
Use that native receipt to finish the VoiceTools
messaging switch-off path and update the Agents Dev Guidelines plus relevant
repository `AGENTS.md` files. Keep VoiceTools available only for explicitly
retained non-messaging capabilities until their replacement or retirement is
approved.

## 1. Decisions and active work order

- [T3 Build Coordinator comprehensive handoff](handoffs/t3-build-coordinator-2026-08-24.md) — full 24 August successor context, current Git/dirty-state exclusions, chronology, operating topology, capability receipt, worker lanes, and immediate continuation instructions.
- [Native Messaging, Session Health, Portfolio, and VoiceTools Retirement Plan](t3-native-messaging-portfolio-consolidation-plan-2026-08-23.md) — authoritative operating topology, current feature receipt, worker split, and start-to-finish checklist.
- [Portfolio Control architecture decision](t3-portfolio-control-architecture-decision-2026-08-19.md) — settles T3 environment identity, T3 Connect/Tailscale/SSH roles, native agent-to-agent dispatch, Heartbeat ownership, and the VoiceTools boundary.
- [Portfolio Control execution plan](t3-portfolio-control-execution-plan-2026-08-19.md) — completed-slice receipts and detailed implementation evidence; use the 23 August consolidation plan for current ordering.
- [Multi-computer connectivity handoff](handoffs/t3-portfolio-control-multi-computer-connectivity-handoff-2026-08-21.md) — verified Mac/Windows/VPS source, GitHub, Tailscale/OpenSSH, T3 environment, recovery, and coordinator handoff evidence.
- [Consolidated Portfolio roadmap](t3-portfolio-consolidated-roadmap-2026-08-17.md) — strategic context, achieved foundation, Heartbeat direction, Rotations direction, and long-term prohibitions.

## 2. Native messaging and Rotations

- [Native agent messaging behaviour guide](t3-native-agent-messaging-behaviour-guide-2026-08-22.md) — proven Alpha method, exact auth/snapshot/dispatch/readback route, reusable agent prompt, and failed/overcomplicated behaviours to avoid.
- [Central native T3 sideband standard](../../agents-dev-guidelines/standards/2026-08-13_native_t3_sideband_agent_coordination.md) — historical exact-title command contract, SSH-as-transport boundary, and rollout evidence. It is optional implementation reference, not a gate for the proven current native send procedure.
- [T3 lifecycle, ports, profiles, and messaging runbook](t3-portfolio-control-t3-lifecycle-and-messaging-runbook-2026-08-22.md) — operational Alpha/Dev lifecycle, profile isolation, restart and worker-stop guidance. Use its 23 August update rather than its historical runtime snapshot.
- [T3/VoiceTools messaging and Portfolio foundation](t3-voicetools-messaging-and-portfolio-foundation-consolidation-2026-08-16.md) — source-traced native `thread.turn.start`, `/api/orchestration/dispatch`, exact target identity, receipt states, and the compatibility boundary. Use as evidence, not as the final VoiceTools architecture.
- [Rotations ordering plan](t3-portfolio-rotations-ordering-plan-2026-08-17.md) — the current read-only Rotations slice: sorting, grouping, telemetry boundaries, prompt preview, authority metadata, and explicit non-goals.
- Native Heartbeat seams — `apps/server/src/portfolio/`, `apps/server/src/cli/portfolio.ts`, `packages/client-runtime/src/state/portfolio.ts`, `apps/web/src/portfolioHeartbeatLifecycle.ts`, `apps/web/src/portfolioHeartbeatDispatch.ts`, and `apps/web/src/portfolioHeartbeatOwnerTransfer.ts` provide the authenticated owner read/initial-claim contract, explicit CLI and web operator claim paths, environment-scoped client claim and receipt commands, paused lifecycle, owner-gated one-proof dispatch, durable transcript receipt readback, staged prepare/accept/finalize transfer commands, and a disabled transfer preview. They do not activate a scheduler or execute a live remote transfer.
- Native agent messaging surfaces — web Portfolio Agents and Rotations use the existing environment-scoped `thread.turn.start` command with exact `{environmentId, projectId, threadId}` identity; mobile uses the same selected target through its durable thread outbox. Neither surface uses VoiceTools as a transport.
- Native visible-worker creation — resolve the exact environment/project,
  reject an exact-title duplicate, issue one native `thread.create`, seed it
  with one `thread.turn.start`, and read back the thread. The 24 August
  `T3 Build Coordinator` creation proved this path without VoiceTools.
- Native environment readiness — web Portfolio Host Health now lists each registered environment's connection phase, target kind, platform/server descriptor, and optional Heartbeat-owner capability; it does not infer peer health or create a second registry.

## 3. Multi-environment T3 capability

- [Remote Architecture](internals/remote.md) — execution environments, environment IDs, saved targets, direct access, T3 Connect relay, Tailscale, and SSH.
- [Connection Runtime](internals/connection-runtime.md) — environment registry, supervisors, reconnection, scoped RPC, and per-environment cached state.
- [Remote Access](user/remote-access.md) — practical desktop, mobile, Tailscale, T3 Connect, pairing, and SSH launch workflows.
- Mobile target projection — `apps/mobile/src/state/portfolioTargets.ts` keeps environment ID, label, connection state, and explicit primary/relay/bearer/SSH identity together; `apps/mobile/src/state/portfolio.ts` and `apps/mobile/src/features/portfolio/PortfolioRouteScreen.tsx` expose owner readback, scoped native thread selection, direct durable-outbox messaging to the selected thread, and links that open the existing full T3 composer.

The confirmed native dispatch chain is `environmentCatalog` →
`EnvironmentRegistry.run`/`acquireSupervisor` → `threadEnvironment.startTurn` →
native `thread.turn.start` → target-thread stream readback. The current Mac Dev
source profile previously had both Windows remotes saved and connected, and a
real VPS target-thread proof completed without VoiceTools. Current daily use is
Mac Alpha on `3773`; collect one current reverse-direction receipt from each
Windows host before disabling VoiceTools messaging. Heartbeat-owner capability
belongs to the source Dev builds and is a later Portfolio concern, not a gate
for native messages.

## 4. Context, session, and storage health

- [T3/Codex storage retention and safe cleanup](../../agents-dev-guidelines/standards/2026-08-23_t3_codex_storage_retention_and_safe_cleanup.md) — canonical protected-state classes, bounded inventory, safe cleanup boundary, and requirements for a future owner-controlled maintenance operation.
- [Portfolio Git and session storage recovery](../../agents-dev-guidelines/DOCS/DEVELOPMENT_PLANS/014_PORTFOLIO_GIT_AND_SESSION_STORAGE_RECOVERY_2026-08-13.md) — dated Mac/VPS measurements, large session groups, Git/worktree distinctions, and completed VPS recovery receipt; re-measure before using any size or candidate list.
- [Storage implementation review prompt](../../agents-dev-guidelines/prompts/2026-08-23_t3_codex_storage_retention_implementation_review.md) — read-only design-review brief for the VPS source implementation worker.
- Existing native seams — `apps/web/src/portfolioContextHealth.ts` and `apps/web/src/portfolioRotation.ts` expose per-thread context telemetry; `apps/server/src/usage/UsageService.ts` already scans provider transcripts with cached file metadata; `apps/server/src/provider/Layers/EventNdjsonLogger.ts` owns bounded provider-event-log retention; and Portfolio Storage currently shows an honest `Not connected` placeholder.

Context usage is not transcript bytes, and transcript bytes are not database
reclaim. The next storage slice reuses the existing Usage walk for one bounded,
environment-scoped read-only inventory. Cleanup and database compaction remain
separate owner-controlled product operations.

## 5. Temporary Heartbeat source evidence

- [VoiceTools Portfolio/Heartbeat port map](voicetools-portfolio-heartbeat-port-map-2026-08-15.md) — the existing Heartbeat, Portfolio ledger, owner, and receipt behavior being migrated. Consult this only when preserving an existing contract during the native T3 port.

## 6. Historical evidence — not current instructions

- [17 August Heartbeat-first roadmap](t3-portfolio-heartbeat-first-roadmap-2026-08-17.md) — superseded VoiceTools-first owner/scheduler plan. Extract legacy lifecycle and import fields only.
- [19 August execution plan](t3-portfolio-control-execution-plan-2026-08-19.md) — detailed dated receipts and source evidence. Its old worker map, launch rows, and “next actions” are not current ordering.
- [21 August connectivity handoff](handoffs/t3-portfolio-control-multi-computer-connectivity-handoff-2026-08-21.md) — dated Git/SSH/Tailscale/T3 proof and recovery evidence. Its old Mac Dev and VoiceTools authority statements are superseded.

## Finish line

The capability is ready for normal use when a Portfolio user can select a
known target environment and native thread from Mac or mobile, send a bounded
message through T3, receive a truthful native receipt, view the target-thread
readback, and later run one owner-backed paused Heartbeat through the same path.
Automatic scheduling, rotation/cutover, and VoiceTools retirement come only
after those proofs are complete.
