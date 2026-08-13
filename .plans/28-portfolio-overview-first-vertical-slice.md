# Portfolio Overview: First Native T3 Vertical Slice

## Decision

Do **not** implement a new standalone portfolio dashboard yet. First make a
small compatibility/reuse map between the existing VoiceTools portfolio-control
system and native T3, then ship the first T3 surface only from that map.

The existing system is substantive, not merely a concept: its Git-recoverable
implementation at VoiceTools commit `5559443f` includes a revisioned portfolio
task and wishlist ledger, receipt linkage, linked Markdown evidence, portfolio
UI assets, and separate heartbeat settings. The live `/portfolio-control`
surface currently presents Tasks, Wishlist, Agents, Heartbeats, and Host
Health; Projects, Documents, Trajectory, and Rants are explicitly marked draft.
A historical runtime path is not current-checkout authority; reconcile source
and contract deliberately rather than duplicate or silently discard it.

The eventual first T3 page may be named **Portfolio Overview**, at
`/portfolio`, but it must become a native T3 shell for the existing GUI model:
it will surface task/wishlist state, agent and host projections, native thread
navigation, and later the deliberately unfinished Projects/Documents/Trajectory
and Rants areas. It intentionally does not create a second backend, registry,
or scheduler.

## Scope and non-goals

In scope:

- A written compatibility map of the existing portfolio ledger, task/wishlist,
  receipt, agent/host projections, heartbeat controls, and draft
  Projects/Documents/Trajectory/Rants areas against native T3 concepts.
- A decision for each existing field/behavior: retain as-is, adapt, defer, or
  explicitly retire. Preserve user-entered ledger data and task receipts.
- Only then, a route and sidebar entry that render after the normal
  authenticated T3 shell has loaded and show the agreed read-only first
  surface.
- The first screen must keep task records distinct from project, agent, and
  native-thread state; it must not invent a project registry from task titles.

Out of scope:

- Replacing the existing portfolio-control ledger or reseeding its data.
- A VoiceTools backend dependency for native coordination, a parallel session
  registry, a poller, or a scheduler.
- A new T3 server service, database table, or WebSocket method before the
  compatibility map shows a specific need.
- Creating, editing, indexing, or reading Markdown from the browser. The
  initial link is a local file opener only; content rendering and indexing are
  later decisions.
- Task mutation, rant capture, automated/manual heartbeat execution,
  notifications, mobile UI, and cross-host deployment changes.

## Source-to-concept map

| Existing source | Native T3 concept to retain | Portfolio Overview use |
| --- | --- | --- |
| `packages/contracts/src/orchestration.ts` | `OrchestrationShellSnapshot`, `OrchestrationProjectShell`, `OrchestrationThreadShell`, including `latestTurn`, `session`, pending approvals/input, proposed-plan flag, and timestamps | Sole live-state source for cards; do not mirror it into a portfolio registry. |
| `packages/client-runtime/src/state/projectEntities.ts` and `apps/web/src/state/entities.ts` | Environment-scoped project/thread atoms and `useProjects`, `useThreadShells`, `useAllEnvironmentShellsBootstrapped` | Derive the view locally from the existing subscribed shell snapshot. |
| `apps/web/src/components/Sidebar.logic.ts` and `apps/web/src/components/SidebarV2.tsx` | Existing project/thread ordering and status vocabulary | Reuse ordering/status presentation helpers where their public interfaces fit; do not invent a second state machine. |
| `apps/web/src/routes/__root.tsx`, `apps/web/src/routes/_chat.tsx`, and `apps/web/src/components/AppSidebarLayout.tsx` | Authenticated application shell and persistent sidebar | Put `/portfolio` beneath the authenticated `_chat` route so it inherits its guard and normal app chrome. |
| `apps/web/src/components/Sidebar.tsx`, `apps/web/src/components/SidebarV2.tsx`, and `apps/web/src/components/sidebar/SidebarChrome.tsx` | Both sidebar variants have to expose the same app-level entry point | Add a compact `Portfolio` navigation item in both sidebars, adjacent to the existing high-level navigation rather than within an individual project. |
| VoiceTools `plan549-runtime-repair` at `5559443f`: `portfolio_task_contract.py`, `portfolio_control.*` | Revisioned tasks/wishlist, receipts, idempotency, allowlisted Markdown evidence | Inspect as the recovery source. Preserve ledger data; decide whether an adapter or migration is justified rather than creating a parallel task model. |
| Live `http://127.0.0.1:8507/portfolio-control` | Tasks, Wishlist, Agents, Heartbeats, Host Health are live; Projects, Documents, Trajectory, Rants are draft | This is the authoritative product surface to map before T3 work. |
| VoiceTools signal-flow audit 06 | Tasks, receipts, heartbeat lifecycle, and direct messaging have distinct authority | Native sideband messaging stays independent; heartbeat remains opt-in and is not part of the first page. |

The VoiceTools sources above are reference vocabulary only. T3 remains the
owner of active projects, threads, turns, and provider session state.

## Data ownership

| Data | Owner in this slice | Read/write rule |
| --- | --- | --- |
| Projects, environments, threads, turns, approvals, input requests, provider session status | Native T3 orchestration snapshot | Read existing client atoms; follow normal T3 routing for a thread click. |
| Current work / handoff | Derived in the web client from thread shell fields | Choose the most recently updated non-archived thread; expose its title, native state, and a link. No persisted duplicate. |
| Notes and trajectory | Markdown in the relevant project/workspace | The card has optional project-local pointers. Initial delivery can use a convention such as `.plans/README.md` and `DOCS/TRAJECTORY/README.md`, but must not claim a document exists until it has been checked locally. |
| Portfolio card metadata (future) | Fork-owned, minimally scoped extension data | Defer schema and storage. It must reference native scoped project/thread refs, never become a session registry. |
| Tasks and rant inbox (future) | Fork-owned task metadata | Defer until a user-created task/capture workflow is designed; one item must link to a native project/thread where applicable. |
| Heartbeats (future) | Native T3 extension configuration and normal native turn dispatch | Bounded, explicit schedules only; no permanent worker or VoiceTools dependency. |

## Card semantics

For every project visible through `useProjects()`:

1. Join its `ScopedProjectRef` to `useThreadShells()` by environment and
   project ID; never join by title.
2. Exclude archived threads. Select the thread with the newest `updatedAt` as
   the current-work/handoff thread. Show `No active thread` when none exists.
3. Render the project title, environment label, workspace root, current-thread
   title, and `updatedAt` using existing formatting helpers.
4. Render state strictly from native fields, in this priority: pending
   approval, pending user input, active/running session, error/interrupted
   session, actionable proposed plan, then ready/quiet. Do not infer progress
   from a Markdown file or VoiceTools data.
5. Make the current thread an ordinary `/$environmentId/$threadId` link using
   `buildThreadRouteParams`/the existing thread-route helpers. A card click
   therefore reuses native transcript, approval, and composer behavior.
6. Render `Notes` and `Trajectory` as optional local links. In the first UI
   they are merely navigation affordances; no file polling, Markdown parsing,
   or document editor is introduced.

The selection is a transparent convenience, not a new canonical task. The UI
should label it “Current thread” rather than “Current task” until a task model
exists.

## Implementation sequence

1. Recover and inspect the portfolio-control sources from `5559443f` without
   checking out, resetting, or changing a runtime. Produce a small field and
   behavior map against native T3 state and the live portfolio-control surface.
   Identify the ledger location/data-preservation requirement separately from
   source recovery. This is the first deliverable, not UI code.
2. Choose the narrowest compatible first interaction. The default is a
   read-only T3 Portfolio Overview that combines existing task/wishlist,
   agent/host, and native current-thread state. If a safe
   bridge for task data is not yet available, show an honest unavailable state
   rather than inventing a duplicate task store.
3. Add a pure `portfolioOverview` derivation module plus focused unit tests.
   It accepts scoped projects, thread shells, and environment labels, returns
   view models, and verifies ties/order/status precedence. It must not
   manufacture a project model from task titles.
4. Add `apps/web/src/routes/_chat.portfolio.tsx` for `/portfolio`. Use the
   existing `SidebarInset` page frame and bootstrap state. Create a small
   `PortfolioOverview` component that consumes `useProjects`,
   `useThreadShells`, and the environment catalog/config selector; do not add
   a server query or polling hook.
5. Add the `Portfolio` navigation affordance to both `Sidebar.tsx` and
   `SidebarV2.tsx`, with active-route styling and mobile-sidebar close behavior
   consistent with existing top-level navigation. Regenerate
   `apps/web/src/routeTree.gen.ts` through the repository's normal route
   generation, never hand-edit it.
6. Add project-local notes/trajectory pointer resolution as a tiny pure
   convention module. It must return absent pointers safely and must not read
   arbitrary filesystem paths from an untrusted server payload. If an existing
   desktop local-file opener is unsuitable for the web client, render
   informative unavailable labels and defer opening rather than adding a new
   backend.
7. Add the selected component and derivation tests. Keep future task,
   capture, heartbeat, and document-index extension points out of the first
   component API unless a real caller needs them.

## Focused validation

- Run the new pure derivation test with `vp test run` and the new component
  test with its directly affected test file(s); do not run the workspace suite.
- Run the affected web package's focused type/lint/format command if available.
- Use the `test-t3-app` isolated-environment workflow for one web pass:
  authenticate through its pairing URL; verify `/portfolio` from both sidebar
  variants; confirm a card reflects a running/attention/quiet native thread;
  follow the current-thread link; and verify zero-project and no-thread empty
  states.
- In browser network/devtools evidence, confirm the view relies on the normal
  shell subscription and adds no periodic requests. No mobile or VoiceTools
  verification is required because neither surface changes.

## Follow-on gates

Only after this view is stable, choose separately whether fork-owned metadata
needs a small T3-backed index. The next smallest interaction could be either a
manual task/rant capture that creates one project-scoped draft, or an explicit
heartbeat configuration screen that dispatches a normal T3 turn. Neither may
introduce a second backend, duplicate session registry, global polling loop,
or broad VoiceTools port.
