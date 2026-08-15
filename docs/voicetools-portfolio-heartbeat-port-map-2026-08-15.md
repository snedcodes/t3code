# VoiceTools Portfolio and Heartbeat port map

Date: 2026-08-15
Scope: source inventory only; no VoiceTools or T3 runtime changes.

## Evidence used

The served Portfolio Control page was compared with the source checkout that contains it:

- VoiceTools UI: `/Users/snedmusic/snedcodes/VoiceToolsSuite-heartbeat-v2/voicetools/voicetools/static/portfolio_control.html` and `portfolio_control.js`.
- VoiceTools API: `/Users/snedmusic/snedcodes/VoiceToolsSuite-heartbeat-v2/voicetools/voicetools/api/server.py`, `heartbeat_service.py`, and `portfolio_task_contract.py`.
- The sibling `/Users/snedmusic/snedcodes/VoiceToolsSuite/voicetools` has the same core `HeartbeatService` and server symbols, but its checked-in source does not contain the Portfolio ledger module. The v2 checkout is therefore the source reference for the live Portfolio page.

## 1. Heartbeat data and lifecycle

`api/heartbeat_service.py:48` defines `HeartbeatService`. Its persisted state is the JSON file `runtime/heartbeat_settings.json`, selected by `server.py:HEARTBEAT_SETTINGS_PATH` and constructed at `server.py:heartbeat_service = HeartbeatService(...)`.

Each target is normalized by `_normal_targets` and `_normal_schedule` (`heartbeat_service.py:430,467`). The real fields are:

- identity: `target_id`, `session_key`, optional `passport_id`, owning-host UUID, label snapshot, and `resolution_state`;
- schedule: interval, daily, or weekly schedule; interval is bounded to 1–10080 minutes and cadence defaults to 15 minutes;
- bounded run: `max_runs`, `run_count`, `expires_at`, `goal_id`, `goal_summary`, `goal_revision`, and `stop_when_goal_reached`;
- lifecycle: `enabled`, `lease_state`, `completion_state`, `pause_reason`, `stop_reason`, and revision;
- overlap and evidence: `prevent_overlap`, deferred count/reason, `last_run_at`, `last_receipt`, receipt history, and self-stop receipt.

`target_upsert` (`heartbeat_service.py:199`) rejects an enabled target without a maximum run count, expiry, or goal self-stop. It also requires revision agreement and rejects high-frequency enabled schedules below five minutes unless explicitly confirmed. `resume_target`, `stop_target`, and `self_stop` (`:289,317,352`) pause or terminate a target; expiry and run exhaustion are reconciled in `run_once`/`_reconcile_target`. The global scheduler is disabled by default (`_default`, `enabled: false`) and starts only from the FastAPI lifespan (`server.py:18586`); `start` (`heartbeat_service.py:637`) checks due schedules at bounded intervals.

Persistence is ordinary JSON read/write through `_load` and `_save`; Portfolio’s separate ledger is `runtime/portfolio_task_ledger.json` by `default_portfolio_ledger_path` (`portfolio_task_contract.py:1083`) and `PortfolioLedger` (`:299`). There is no T3-owned duplicate Heartbeat store in the current T3 fork.

## 2. What executes a Heartbeat today

The scheduler calls the injected `_dispatch_heartbeat_target` (`server.py:38227`). That calls `_heartbeat_direct_send_once` (`:38189`), which calls `_enqueue_codex_command_internal` with `source="heartbeat_scheduler"` and `transport_mode="t3_http_dispatch"`. The command is then handled by `CodexCommandService.enqueue_command` / its worker and adapter (`api/codex_command_service.py:CodexCommandService`). It resolves a Passport/session through `_find_overseer_heartbeat_target` (`server.py:37801`), optionally reads local T3 activity through `_heartbeat_target_activity`, retries only definite transport failures, and stores a command/adapter receipt.

That VoiceTools direct-command path is the delivery mechanism T3 must replace. The scheduler’s target rules, pause/stop rules, and receipt semantics should be ported faithfully; the message should be submitted as a normal T3 `thread.turn.start` command against the canonical `environmentId + threadId`, so the turn becomes part of the ordinary native thread timeline. VoiceTools phone alerts/TTS are not required for this port and must not be the sole delivery or readback path.

## 3. Portfolio Control relationships and authority

| View        | Actual source and relationship                                                                                                                                                                                                                                                               |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tasks       | `api/portfolio_task_contract.py:PortfolioLedger.list_tasks/create_task/update_task`; authoritative VoiceTools JSON ledger. UI uses `/api/portfolio/tasks`. Tasks contain owners, completion conditions, checklists, receipts, and optional `heartbeat_target_ref`.                           |
| Wishlist    | Same `PortfolioLedger` (`list_wishlist`, `promote_wishlist`); authoritative VoiceTools ledger. Promotion creates a Task and explicitly does not create or activate a Heartbeat (`portfolio_control.js:755`).                                                                                 |
| Heartbeats  | `HeartbeatService` and owner-routed `/api/assistant/heartbeat/federated/targets`; authoritative on the owning VoiceTools backend. The UI displays scheduler authority, target lifecycle, cadence, limits, receipts, and controls.                                                            |
| Agents      | `/api/codex/session-inventory` (`server.py:get_codex_session_inventory`) and the UI’s projection. It displays Passport, host, project, model, and activity; it is not a second session registry.                                                                                             |
| Host Health | `api/host_health.py:collect_host_health` through `/api/system/host-health` (`server.py:22751`). It is a bounded diagnostic sample with cache/unknown fallback, not Heartbeat authority or a proof that a remote T3 turn can run. Peer status comes separately from `/api/codex/peer-status`. |
| Projects    | The original UI labels this a Plan 544 draft destination. Current project context and trajectory data are distributed across configured repositories and T3 project state; no single Portfolio project browser is present in this source slice.                                              |
| Documents   | `PortfolioDocumentReader` (`portfolio_task_contract.py:157`) can read allowlisted local Markdown records linked from ledger items. It is readback, not a universal document registry.                                                                                                        |
| Trajectory  | VoiceTools reads project `DOCS/TRAJECTORY`/daily documents for context (`server.py` trajectory helpers); those repository documents remain their own authority. Portfolio Control displays/proposes context but does not replace them.                                                       |
| Rants       | In v2, `PortfolioLedger` contains Rants and review-only proposals (`portfolio_task_contract.py:378,659,724`). Original text is preserved; proposals do not overwrite authoritative trajectory. The older served route may show this as a draft/later destination.                            |

## 4. Cross-host and messaging dependencies

VoiceTools can temporarily retain the Portfolio ledger, owner-host routing, host-health diagnostics, federated read-only inventory, and command receipts while the port is staged. Its `/api/assistant/heartbeat/federated/targets` route reads each owner’s state without copying authority; mutations route to the owner (`server.py:38749,38805`).

Native T3 must own the target’s exact native thread identity, normal turn submission, turn activity/overlap evidence, native timeline, and final turn receipt. A remote VoiceTools backend cannot safely guess a peer-owned T3 target: `_find_overseer_heartbeat_target` fails closed when identity is missing or ambiguous, and `_heartbeat_target_activity` only uses the local T3 projection for local targets. This is the direct reliability reason to replace VoiceTools command delivery with native T3 dispatch while leaving other VoiceTools projections temporarily connected later.

## 5. Direct behavior map to current T3

| VoiceTools behavior          | Current T3 location                                                                                                                                                                                                                                      | Port status                                                                                         |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Session/project inventory    | `apps/web/src/state/entities.ts` (`useProjects`, `useThreadShells`), `apps/web/src/components/Sidebar.tsx`                                                                                                                                               | Native source already exists; use these refs, not a new registry.                                   |
| Select/open a native thread  | `apps/web/src/threadRoutes.ts`, `apps/web/src/routes/_chat.$environmentId.$threadId.tsx`, `apps/web/src/components/ChatView.tsx`                                                                                                                         | Existing route and right pane are the destination.                                                  |
| Submit one normal agent turn | `packages/client-runtime/src/state/threadCommands.ts:166` (`startTurn`), `packages/contracts/src/orchestration.ts:812` (`thread.turn.start`), `apps/server/src/orchestration/decider.ts:914`, `ProviderCommandReactor.ts:1072`, `ProviderService.ts:710` | This is the replacement for `_enqueue_codex_command_internal`.                                      |
| Turn activity and receipts   | `apps/web/src/state/threads.ts`, orchestration projections in `apps/server/src/orchestration/Layers/ProjectionPipeline.ts` and `ProviderRuntimeIngestion.ts`                                                                                             | Existing native projections are the overlap/readback authority.                                     |
| Heartbeat navigation shell   | `apps/web/src/components/AppSidebarLayout.tsx` and `PortfolioModeNavigation.tsx`                                                                                                                                                                         | Already a paused, presentation-only shell from commit `161bdf471`; no scheduler or VoiceTools call. |
| Task/Wishlist/Rant ledger    | No native equivalent in the current T3 slice                                                                                                                                                                                                             | Port later behind a deliberate contract; do not create a parallel database now.                     |
| Host health / peer status    | No native Portfolio equivalent in the current T3 slice                                                                                                                                                                                                   | Keep truthful unavailable labels until an approved native source exists.                            |

## 6. Smallest first implementation slice

The next code slice should be a read-only native Heartbeat configuration/status model for real native T3 thread targets, paused by default. It should display the existing lifecycle fields above and derive selectable targets from `useProjects`/`useThreadShells`; it must not schedule, persist, dispatch, or call VoiceTools. The current navigation shell can host that view.

Likely owned files:

- `apps/web/src/components/PortfolioModeNavigation.tsx` — render the truthful Heartbeats view and target selection state;
- `apps/web/src/components/AppSidebarLayout.tsx` — pass the selected native thread/project context into the Portfolio view;
- a small web-only pure model/test file beside the component if needed for normalization and paused-default rendering.

Do not change `packages/contracts`, `apps/server`, persistence, or provider dispatch in that first read-only slice. The subsequent faithful port can add a schema-only contract and server-owned state only after the state owner is chosen; its dispatch implementation must call the existing native `thread.turn.start` path, not recreate `CodexCommandService`, a broker, a poller, or a second session registry.

### Deliberate non-goals in this tranche

No Heartbeat code, scheduler, automatic dispatch, VoiceTools API call, polling, database, storage migration, runtime action, packaging, installer, TTS, or Realtime Assistant feature was added. This document records the source facts and port boundary only.
