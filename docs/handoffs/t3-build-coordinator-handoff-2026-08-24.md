# T3 Build Coordinator rotation handoff — 24 August 2026

## 1. Identity and status

- Outgoing visible title: `T3 Build Coordinator 24 Aug`; Mac Alpha project `T3 Code Reliability`, environment `Mac Alpha` (`127.0.0.1:3773`, `/Users/snedmusic/.t3`).
- Incoming title: `T3 Build Coordinator 24 Aug Successor` in VPS Dev project `T3 Dev VPS Source`.
- Active source checkout: `C:\Users\Administrator\src\t3-snedcodes-dev-git`; Mac reference checkout: `/Users/snedmusic/snedcodes/t3-snedcodes-dev`.
- Branch/HEAD (Mac reference and original VPS checkout): `sned/t3-portfolio-control-dev-2026-08-21` / `03ceb09a8bc67841300028e111a31c3fae9dbe24`.
- Date/timezone: 2026-08-24, Australia/Melbourne. Status: `ready_with_caveats`.

## 2. Executive orientation

The programme is consolidating T3 Portfolio reliability work: native-only worker messaging, stable Alpha versus isolated Dev topology, and practical Heartbeats, Storage Health, Tasks/Wishlist, then Rotations. The current useful end state is source-backed, authenticated VPS Dev capability proven through real canonical operations, without disturbing Mac Alpha or dirty work. A real Task/native-receipt vertical slice is now proven; the immediate repair is Heartbeat same-owner freshness.

## 3. Authority and architecture

Read in this order:

1. [AGENTS.md](../../AGENTS.md) — current source authority, rapid vertical slices and safety.
2. [24 Aug coordinator handoff](t3-build-coordinator-2026-08-24.md) — broad historical programme evidence.
3. [native messaging consolidation plan](../t3-native-messaging-portfolio-consolidation-plan-2026-08-23.md) — active execution plan.
4. [current work index](../t3-portfolio-control-current-work-index-2026-08-17.md) — priority order.
5. [native messaging guide](../t3-native-agent-messaging-behaviour-guide-2026-08-22.md) and [lifecycle runbook](../t3-portfolio-control-t3-lifecycle-and-messaging-runbook-2026-08-22.md) — operational authority.

Native T3 is the ordinary route. Resolve live environment/project/thread from authenticated snapshot, use titles only to find raw IDs, send exactly one `thread.turn.start`, retain sequence/commandId/messageId, and read the target before retrying uncertainty. Never use VoiceTools, `/api/codex`, guessed/title-only IDs, direct SQLite/storage, or hidden agents. T3 state is owned by the normal server APIs; Tasks/Wishlist and Heartbeats have canonical server owners. Alpha is packaged stable owner; VPS Dev is source owner and must remain isolated.

## 4. Trajectory and completed evidence

- Mac visible workers were historically created in Alpha even when named VPS; user now permits reusing existing workers but forbids new workers except this explicit rotation.
- VPS `3773` is packaged Alpha with an old profile; VPS source Dev is `3774`, web `5733`, profile `C:\Users\Administrator\.t3-dev`, lifecycle owner Windows Scheduled Task `T3 Code Source Dev`. Do not restart it manually.
- User paired VPS Dev in the browser on 24 Aug. Authenticated Dev snapshot proved project `T3 Dev VPS Source` raw ID `072a6a8f-92f4-464f-8298-5b6e8869f967`, environment `deb09b61-53a8-4b71-b662-4db4c56c3254`.
- Task/Wishlist source slice is implemented in server/contracts/client-runtime/web/mobile. Focused server TaskOwner test 5/5, mobile helper tests 3/3, scoped contracts/client-runtime/web/mobile checks passed, and diff checks passed (only pre-existing CRLF warning noted previously).
- Real authenticated Dev proof: created Task `vps-dev-native-receipt-20260824`, native-dispatched it to exact thread `Report Environment Context` raw `132fd1c7-890e-4efc-bc10-6895fa1fc8a5`; dispatch sequence `710`, command `b447f2a0-5cb0-40d9-80b8-9b3b44d1d290`, message `253ad163-acdd-43d6-a90d-f6e96f5fc9b7`. Target transcript confirmed arrival. Receipt persisted and Task reached `complete`, revision 3.
- Rotations source already uses exact target/native dispatch and focused validation passed; no scheduler/second controller was added.
- Heartbeat authenticated readback exists but was stale with zero records. Same exact owner claim was accepted but left old `updatedAt`, exposing the current repair seam.

## 5. Current work in progress

Existing Mac-visible worker `T3 VPS Storage Health Lane 24 Aug` (`e56c67f5-1aaa-4460-b6b4-5cfc69d6be6c`, Luna/xhigh) owns the narrow VPS source repair. Its native receipt: sequence `898025`, command `e7b0c838-c39a-436f-a9d5-a9c4b28aff99`, message `7e4dea14-f7af-4121-8d48-e3df72500ed0`. It changed only:

- `apps/server/src/portfolio/PortfolioHeartbeatOwner.ts`
- `apps/server/src/portfolio/PortfolioHeartbeatOwner.test.ts`

Worker evidence: repeated exact-owner claim now persists refreshed `updatedAt`, preserves epoch/target/state; focused test 6/6 and diff check passed. It was then corrected that VPS Dev is paired and must prove authenticated `GET -> identical claim -> GET`; its turn is currently running. Verify actual VPS diff/test/readback before accepting.

## 6. Git/worktree boundaries

Preserve all dirty work. Original VPS dirty set includes desktop EPIPE, auth, Heartbeat, server/http, usage/storage, web preview/diff, contracts/client-runtime, Tasks/Wishlist and mobile files. Important new/untracked files include `PortfolioTaskOwner.ts/.test.ts`, mobile portfolio task/wishlist helpers/tests, storage inventory files, and docs listed by `git status`. Do not reset/clean/check out. No commit/push was made by this coordinator.

## 7. Runtime safety

- Keep Mac Alpha (`/Users/snedmusic/.t3`, `3773`) stable; never restart/rebuild/quit it.
- Do not start a second owner against any T3 home. Do not alter production/Alpha profiles, credentials, VoiceTools, external services, or publication state.
- VPS Dev is currently listening on `3774`; user paired browser at `http://localhost:5733`. Short-lived CLI auth sessions from `.t3-dev` are now authorised for bounded Dev operations; do not print tokens or mint pairing links unnecessarily.
- User stopped `T3 VPS Heartbeat Foundation Lane 24 Aug`; leave it stopped.

## 8. Worker model

Visible relevant workers: Mac project `T3 Code Reliability`: Storage Health Lane (active repair, above), Stability Lane (Rotations proof), Mobile Tasks Recovery and Mobile Tasks Lane (mobile Task/Wishlist work), Tasks Vertical Slice (server/web work). VPS Dev project: `T3 VPS Native Receipt Lane 24 Aug` raw `9eae734a-01ca-4ef6-b3a7-556fc9ca60e9` is unreliable: it drifted to Mac MCP and falsely reported a 401; do not trust claims without runtime evidence. User-stopped VPS Heartbeat Foundation raw `0d38aa67-934b-4f92-aa06-e2c307a033f1` must remain stopped.

Prompts must state objective, bounded ownership, expected output, focused validation, safety boundary, report location, and permission only inside seam. Inspect source/tests/runtime after meaningful completions. Do not repeatedly ping a healthy worker.

## 9. Source map

- `packages/contracts/src/portfolio.ts`: Portfolio target, Task, Wishlist, Heartbeat schemas; terminal Task status is `complete`.
- `packages/contracts/src/environmentHttp.ts`: canonical HTTP routes.
- `apps/server/src/portfolio/PortfolioHeartbeatOwner.ts` and `.test.ts`: current freshness repair.
- `apps/server/src/portfolio/PortfolioTaskOwner.ts` and `.test.ts`: canonical Task/Wishlist persistence/receipt behavior.
- `apps/server/src/portfolio/http.ts`, `apps/server/src/server.ts`: endpoint and layer composition.
- `packages/client-runtime/src/state/portfolio.ts`, `apps/web/src/components/PortfolioModeNavigation.tsx`, `apps/mobile/src/features/portfolio/PortfolioRouteScreen.tsx`: client surfaces.

## 10. Pitfalls

- Do not confuse VPS Alpha `3773` with source Dev `3774`/web `5733`.
- Windows remote PowerShell wrapper breaks on unescaped pipes/`Select-Object`; use encoded PowerShell or simple commands.
- Native worker transcript assertions are context only; verify APIs, source and receipts.
- The old goal was marked blocked before pairing; user later paired Dev. Treat the goal as resumed even if the harness status is stale.
- Do not re-run an uncertain dispatch; read its target thread first.

## 11. Continuation plan

1. Verify and accept/reject the active Heartbeat freshness repair with focused test, VPS authenticated before/after readback, and diff evidence. Then create one paused Heartbeat record only if the plan's bounded proof still requires it; no scheduler yet.
2. Review authenticated Tasks/Wishlist UI/readback against the real Dev project and retain the completed native receipt; repair only a concrete seam.
3. Advance Rotations only after Heartbeat/Storage/Tasks are stable: exact Rotate/successor/cutover action, one canonical native dispatch, no second controller.

## 12. Exactly three immediate actions

1. Read the Storage Health worker's current native transcript and VPS source diff; verify its authenticated same-claim `fresh` proof.
2. If it passes, inspect the active plan's bounded Heartbeat-record requirement and assign the smallest paused-record proof to an existing permitted worker; otherwise direct the narrow repair.
3. Reconcile the real authenticated Dev Portfolio screen/readback with the Task/Wishlist receipt and move the next unfinished exact-target capability forward.
