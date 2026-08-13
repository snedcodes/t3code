# Portfolio Overview: First Native T3 Vertical Slice

## Decision

Ship one read-only web view named **Portfolio Overview**, at `/portfolio`.
It is a compact cross-project cockpit for the work T3 already owns: project
cards, each project's current thread/handoff, native thread state, and links
to durable project notes and trajectory documents. It intentionally does not
create, schedule, or dispatch anything.

This is the smallest useful portfolio tab because it answers, without another
service: *what projects exist, what is active, what needs attention, and where
is the durable context?* It is the appropriate first landing point for later
task capture, heartbeats, and rants, but none of those controls belong in this
slice.

## Scope and non-goals

In scope:

- A route and sidebar entry that render after the normal authenticated T3
  shell has loaded.
- Project cards derived from the existing multi-environment shell snapshot.
- One deterministic current-work thread per project, its existing state, and
  a normal native thread link.
- A Markdown notes/trajectory link area, empty when no path has been attached
  to the project yet.
- Loading and empty states that make no background requests beyond the T3
  shell subscription already used by the application.

Out of scope:

- A VoiceTools backend dependency, session registry, Passport lookup, feed,
  poller, scheduler, or migration.
- A new T3 server service, database table, WebSocket method, or contracts
  change for the initial view.
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
| `VoiceToolsSuite/voicetools/DOCS/TRAJECTORY/README.md` | Trajectory is a concise, durable continuity/handoff layer, not a live session database | Preserve this as the notes/trajectory document model: attached Markdown documents are authoritative for narrative context. |
| `VoiceToolsSuite/voicetools/voicetools/api/heartbeat_service.py` | A heartbeat is opt-in, bounded, lifecycle-aware, and should avoid overlapping active work | Carry only this future design constraint. Do not reuse its state file, scheduler, dispatch path, or API. |
| `VoiceToolsSuite/voicetools/voicetools/api/server.py` portfolio-focus feed | A manually promoted portfolio focus item is a useful later interaction concept | Explicitly do not port its queue/store/hydration machinery. A later native T3 task extension may supply a much smaller equivalent. |

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

1. Add a pure `portfolioOverview` derivation module plus focused unit tests.
   It accepts scoped projects, thread shells, and environment labels, returns
   card view models, and verifies ties/order/status precedence. Keeping it
   pure prevents UI state from acquiring ownership of native thread state.
2. Add `apps/web/src/routes/_chat.portfolio.tsx` for `/portfolio`. Use the
   existing `SidebarInset` page frame and bootstrap state. Create a small
   `PortfolioOverview` component that consumes `useProjects`,
   `useThreadShells`, and the environment catalog/config selector; do not add
   a server query or polling hook.
3. Add the `Portfolio` navigation affordance to both `Sidebar.tsx` and
   `SidebarV2.tsx`, with active-route styling and mobile-sidebar close behavior
   consistent with existing top-level navigation. Regenerate
   `apps/web/src/routeTree.gen.ts` through the repository's normal route
   generation, never hand-edit it.
4. Add project-local notes/trajectory pointer resolution as a tiny pure
   convention module. It must return absent pointers safely and must not read
   arbitrary filesystem paths from an untrusted server payload. If an existing
   desktop local-file opener is unsuitable for the web client, render
   informative unavailable labels and defer opening rather than adding a new
   backend.
5. Add the selected component and derivation tests. Keep future task,
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
