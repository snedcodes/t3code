# T3 Portfolio navigation design

Status: design only. No routes, UI, sessions, runtimes, or Heartbeats change
in this tranche.

## Recommendation

Use a small hybrid navigation:

```text
┌ T3 Code ── [Agents] [Portfolio] ───────────── project / thread header ┐
│                                                                        │
│ existing T3 sidebar          current page                              │
│ projects                     ...                                       │
│ threads                                                                │
│ settings                                                                │
└────────────────────────────────────────────────────────────────────────┘
```

The two buttons are global shortcuts. The existing T3 sidebar stays in place
for normal project and thread work. Portfolio Control keeps its own grouped
navigation inside the Portfolio page.

This gives the user a quick way to reach the two new work areas without
replacing the navigation that already works.

## Why the empty top-bar area works

The area is suitable for two compact buttons because:

- it is visible while a normal T3 thread is open;
- Agents and Portfolio are app-level destinations, not project children;
- two short buttons fit without competing with the current project/thread
  title and controls.

There is one technical detail: the desktop chat header uses a draggable
title-bar region in [ChatView.tsx](../apps/web/src/components/ChatView.tsx).
The buttons must be marked as non-draggable clickable controls. They must also
respect the existing sidebar toggle and macOS window-control spacing.

The area is not suitable for the full Portfolio menu. Ten destinations would
make the header crowded and would be difficult to use on a narrow screen.

## Existing T3 pattern

T3 already uses:

- the main sidebar for projects and threads;
- the sidebar footer for Settings and Portfolio Control;
- the chat header for the current project/thread context;
- native routes for opening a thread, including
  `/$environmentId/$threadId`.

The relevant code is in [AppSidebarLayout.tsx](../apps/web/src/components/AppSidebarLayout.tsx),
[SidebarChrome.tsx](../apps/web/src/components/sidebar/SidebarChrome.tsx), and
[portfolio-control.tsx](../apps/web/src/routes/portfolio-control.tsx).

The new buttons should follow the existing T3 button style. They should not
look like a second sidebar or a separate application.

## VoiceTools structure to carry forward

The live VoiceTools page at [Portfolio Control](http://127.0.0.1:8507/portfolio-control)
uses this information architecture:

```text
Work
  Tasks
  Wishlist
Operations
  Agents
  Heartbeats
  Host Health
Plan 544
  Projects       Draft
  Documents      Draft
  Trajectory     Draft
  Rants          Draft
```

Its served page and JavaScript read Tasks, Wishlist, session inventory,
Heartbeat settings, host health, and peer status. The later sections are
explicit draft destinations. T3 should keep these names and groupings.

For the T3 version, the Portfolio home should put Heartbeats first because it
is the user's main operations view:

```text
Portfolio Control

Heartbeats        ← first screen; paused/native status is visible
Tasks
Wishlist
Agents
Host Health
──────────────
Projects         Draft / later
Documents        Draft / later
Trajectory       Draft / later
Rants            Draft / later
```

This changes the starting emphasis, not the information architecture.

## Concrete options

### Option 1 — top bar only

```text
T3 Code   [Agents] [Portfolio]                 current project / thread
```

Destinations:

- Agents → `/agents` — native project/thread overview.
- Portfolio → `/portfolio-control` — Heartbeats-first Portfolio home.

Selected state: the active button gets the same subtle foreground/background
state used by T3 active navigation. Agents is selected on `/agents` and
Portfolio is selected on `/portfolio-control` and its subviews.

Narrow behavior: show both buttons only when there is room; otherwise combine
them into one `Navigate` button with an Agents/Portfolio menu.

Strength: very easy to find. Weakness: the top bar becomes the only way to
find these areas, and the full Portfolio sections still need another menu.

### Option 2 — sidebar only

```text
T3 sidebar
  Projects
  Threads
  Portfolio Control
  Agents
  Settings
```

Destinations:

- Agents → `/agents`.
- Portfolio Control → `/portfolio-control`.

Selected state: active sidebar row and active Portfolio section.

Narrow behavior: use the existing sidebar drawer and close it after a
destination is chosen.

Strength: matches current T3 navigation. Weakness: the destinations are less
visible when the sidebar is collapsed and does not use the requested top-bar
space.

### Option 3 — hybrid, recommended

```text
T3 Code   [Agents] [Portfolio]                 current project / thread

Existing sidebar: projects, threads, settings, Portfolio Control
Portfolio page: Heartbeats, Tasks, Wishlist, Agents, Host Health, later drafts
```

Destinations:

- Agents button → `/agents` — native overview of existing T3 projects and
  thread/session shells.
- Portfolio button → `/portfolio-control` — Heartbeats-first home.
- A native thread card → existing `/$environmentId/$threadId` route.
- A project/thread in the existing sidebar → existing T3 project/thread flow.

Selected state: the top-bar button is active for its destination; the
existing sidebar remains active for the current project/thread. Inside
Portfolio, the selected section uses the existing violet active-row treatment.

Narrow behavior: keep one compact `Navigate` control in the top bar. Its menu
contains `Agents` and `Portfolio`. The existing sidebar drawer remains the
place for projects, threads, and settings. Portfolio's internal navigation
becomes a horizontal scroll row or a compact section menu; it does not move
into the top bar.

This is the best balance of fast access, familiar T3 navigation, and the
VoiceTools Portfolio structure.

## Screen flow

### Agents

`Agents` opens a native T3 overview:

```text
Agents
  Project A
    Agent/thread card → open native thread
  Project B
    Agent/thread card → open native thread
```

The data comes from existing native T3 projects and thread shells. Each card
shows the thread title, project, environment, model/session status when
available, and a link to the normal native thread route.

It does not create an agent registry, Passport mirror, or separate session
database. The current Portfolio Control Agents view already provides most of
this native data and is the immediate implementation source.

### Portfolio

`Portfolio` opens `/portfolio-control` with Heartbeats selected first:

```text
Portfolio Control
  Heartbeats  [selected]
  Tasks
  Wishlist
  Agents
  Host Health
  Projects / Documents / Trajectory / Rants [Draft]
```

The Portfolio Agents section can link to the same native thread cards as the
global Agents page. It is a view into the same T3 state, not a second copy.

The existing Portfolio route currently has the grouped sections and native
Agents, Host Health, and paused Heartbeat foundation. The next UI slice would
only change the entry flow and default section; it would not add Heartbeat
behavior.

## What can be built now

Available from native T3 data now:

- the two compact global buttons;
- the `/agents` native project/thread overview;
- links from agent cards to normal T3 thread routes;
- `/portfolio-control` with Heartbeats first;
- native environment/host context;
- paused Heartbeat status and active native-thread target selection;
- honest Draft labels for later sections.

Still owned by VoiceTools and needing a later port:

- authoritative Tasks and Wishlist records, revisions, checklists, and
  receipts;
- VoiceTools Passport/host ownership and federated session inventory;
- live Heartbeat settings, persistence, pause/resume, and run-once behavior;
- VoiceTools host-health diagnostics and peer status;
- Projects, Documents, Trajectory, and Rants data and their source contracts.

Until those contracts move, T3 should show `Not connected` or `Draft` rather
than inventing records. The current native T3 Agent and Heartbeat views should
remain read-only where the VoiceTools source is still authoritative.

## Recommendation and next slice

Choose **Option 3 — hybrid**.

The next implementation slice is small:

1. Add compact `Agents` and `Portfolio` buttons to the app-level top bar,
   keeping them outside the draggable region.
2. Add the native `/agents` overview using existing project/thread state.
3. Make `/portfolio-control` open on Heartbeats first, while preserving the
   existing internal sections and normal project/thread navigation.
4. Verify desktop and narrow layouts with one focused UI smoke check.

Do not add a database, session registry, VoiceTools proxy, polling, scheduler,
or Heartbeat activation as part of that slice.
