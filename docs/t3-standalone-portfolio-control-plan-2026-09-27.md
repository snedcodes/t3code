# Standalone T3 Portfolio Control

Date: 27 September 2026
Status: Mac coordination plan; VPS source and runtime remain authoritative

## Goal

Keep Tasks and recurring Heartbeats usable while the T3 Dev app is rebuilt or upgraded. Provide a dedicated Portfolio web address and a Mac desktop window for Tasks, Heartbeats and adjacent Portfolio views. The standalone view and the integrated T3 Dev Portfolio view must show **the same records**, not periodically synchronize two databases.

The VPS remains the always-on owner. Mac, Windows laptop and VPS agents are native T3 target environments. A Heartbeat stores an exact target environment/project/thread and delivers through native `thread.turn.start` with a visible receipt. VoiceTools is a visual/behavior reference, not a runtime, sender or data source.

## What exists today

- The earlier VoiceTools Portfolio Control was `voicetools/static/portfolio_control.{html,css,js}`, served by the VoiceTools FastAPI backend at `/portfolio-control`. Its dark-card Task layout is useful design material. The VoiceTools Electron app is a broader transcription shell; it is **not** an independent Task/Heartbeat owner to revive.
- Authoritative current T3 source is `C:\Users\Administrator\src\t3-snedcodes-dev-git` on the VPS. Native Task/Heartbeat contracts, VPS-owned records, update APIs, web controls, scheduler and receipts are implemented there. The user-approved v0.0.42 integration plan is `docs/t3-dev-v0.0.42-integration-and-android-continuation-2026-09-27.md` at VPS commit `500c96ce4`.
- The current server scheduler handles targets local to its environment. For **remote** targets, `apps/server/src/portfolio/PortfolioHeartbeatScheduler.ts` leaves the record due, while `apps/web/src/AppRoot.tsx` mounts `usePortfolioHeartbeatRemoteDispatcher` from `apps/web/src/state/portfolio.ts`. Therefore remote delivery currently depends on a running web client. A standalone window would not make remote Heartbeats reliable if that client closes. This is the first functional repair in this lane.
- Current Task and Heartbeat HTTP operations already live under `/api/portfolio/` and `packages/client-runtime/src/state/portfolioHeartbeatOwnerHttp.ts`. The web Portfolio view uses environment-scoped client-runtime atoms. Reuse these contracts; do not rebuild the old VoiceTools Python backend.

## Single-owner arrangement

Use one stable VPS Portfolio-owning T3 process and state profile, separate from the frequently rebuilt T3 Dev process. Near term, pin the already-working custom T3 source as that stable owner and retain its existing owner profile/record IDs through a deliberate one-owner handover. Run the v0.0.42 integration checkout against its own isolated Dev profile and ports. Never run both processes against the same T3 home.

The stable owner alone stores Tasks, Wishlist items, Heartbeats, schedules, run state and receipts. The standalone web app, Mac Electron window and integrated Dev Portfolio view are clients of that owner. An edit from any client goes to the same native API and becomes visible in the other clients on readback/refresh or normal subscription. This is live shared state, **not** two-way replication or a conflict-resolution system.

Longer term, the stable owner can itself move to a newer T3 source once the v0.0.42 lane carries the Portfolio owner cleanly. Preserve Task/Heartbeat IDs, history and target identity through the supported owner-transfer/export path before switching that one owner. Do not manually edit the runtime database or run two schedulers during the change.

## Build order

1. **Make remote scheduling independent of a browser.** Move the remote due-record dispatch responsibility from the web `AppRoot` hook to the stable VPS owner process, using T3's existing environment connection and `thread.turn.start` path. Keep one claim/run/receipt path and disable the browser dispatcher once the owner path works. Prove one remote Heartbeat fires with every Portfolio browser window closed.
2. **Pin the stable owner.** Establish one source checkout and startup/lifecycle owner for the current working Portfolio build, using the existing owner state exactly once. Give it a stable private-network URL and verify Task read/update, Heartbeat cadence/stop, and native target reachability after a process restart. The current Dev source may remain the owner until this handover is complete; no premature second writer.
3. **Expose a dedicated web surface.** Start with the existing T3 Portfolio UI behind a direct, bookmarkable Portfolio address on the stable owner. Use native T3 pairing/authentication and same-origin APIs. Restore the pleasant dark-card styling as an option while retaining the current T3 appearance. The first useful screens are Tasks, Heartbeats, linked records, checklist/evidence, custom messages, receipts and exact human-readable targets; bring Wishlist/Agents/Host Health/Rotations over only where current T3 already provides truthful data.
4. **Add the Mac app as a thin shell.** An Electron window can load that same authenticated Portfolio web surface. It owns window/menu/notifications only; it does not bundle VoiceTools Python, store a second Task ledger, schedule Heartbeats, or send agent messages itself. Browser access works without the Mac app. Packaging follows a working web use, not the other way around.
5. **Point integrated T3 Dev at the same owner.** As the v0.0.42 lane ports the integrated Portfolio UI, select the stable Portfolio owner through the normal T3 environment catalog and reuse the same client-runtime API. Dev can be rebuilt, restarted or moved to a new profile without changing the Portfolio records or scheduler. Avoid initializing a second Task/Heartbeat owner in Dev.
6. **Keep behavior in lockstep.** One contract/API and focused owner tests define Task/Heartbeat behavior. UI styling may differ, but create/edit/complete, Heartbeat On/Off, custom message, cadence, receipt and Task-linked stop semantics must agree. Whenever either UI gains a field or action, verify the other reads it and can perform the applicable update.

## First acceptance

With the stable owner running and the Dev browser closed: create a Task and linked recurring Heartbeat in the standalone web view, target an existing Mac thread, observe native delivery and receipt, edit Task checklist/evidence in the integrated Dev view, see the change in standalone, then complete the Task and confirm the Heartbeat turns Off. Repeat a bounded target-delivery check for the Windows laptop and VPS before claiming three-machine coverage. Reopen/rebuild Dev during the exercise; the standalone Portfolio and schedule should continue operating.

## Boundaries and next assignment

Do not start the retired VoiceTools backend, import its Passport/session registry, create another message broker, duplicate T3 projects/threads, or make Mac Electron the scheduler. A VPS outage still prevents dispatch; a Mac window cannot make VPS-owned Heartbeats run while the VPS is unavailable. Read-only cached display could be considered later, but must not pretend to be live control.

This is a parallel lane to the v0.0.42 Dev integration. The first implementation task is narrowly defined: make remote Heartbeat delivery owner-side and prove it without a web client. Then pin the stable owner and expose the web view. Only after that build the Electron shell and switch the integrated Dev Portfolio view to the same owner.
