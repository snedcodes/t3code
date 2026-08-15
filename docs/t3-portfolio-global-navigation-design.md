# T3 Portfolio navigation design

Status: design only. No routes, UI, sessions, runtimes, or Heartbeats change
in this tranche.

## Chosen interaction model

The top bar has two buttons:

```text
┌ T3 Code ── [Agents] [Portfolio] ───────── current project / thread ┐
│                                                                    │
│ left pane                         right pane                       │
│ normal projects/threads           selected thread or view          │
└────────────────────────────────────────────────────────────────────┘
```

Normal mode remains unchanged. The left pane shows the normal T3 project and
thread list, and the right pane shows the selected native thread.

### Agents mode

```text
Top bar: [Agents] [Portfolio]

Left pane                         Right pane
Agents / sessions                 selected native T3 thread
  Project A
    Agent session 1  [selected] → thread conversation
    Agent session 2
  Project B
    Agent session 3
```

Clicking **Agents** replaces the normal left project/thread list with a native
Agents/session list. Selecting an item opens its normal native thread in the
right pane.

Destination mapping:

- Agents mode: proposed `/agents` shell destination.
- Selecting a session: existing `/$environmentId/$threadId` native thread
  route.
- Projects, threads, and session data: existing native T3 state only.

Agents mode does not create an agent registry, Passport mirror, or second
session database.

### Portfolio mode

```text
Top bar: [Agents] [Portfolio]

Left pane                         Right pane
Portfolio Control                 selected Portfolio view
  Heartbeats       [selected]  → Heartbeat view
  Tasks                         Tasks view
  Wishlist                      Wishlist view
  Agents                        Native Agents view
  Host Health                   Host Health view
  Projects       Draft          Draft view
  Documents      Draft          Draft view
  Trajectory     Draft           Draft view
  Rants          Draft           Draft view
```

Clicking **Portfolio** replaces the normal left project/thread list with the
original VoiceTools Portfolio Control-style view options. Selecting an option
changes the right pane to that Portfolio view.

Destination mapping:

- Portfolio button: `/portfolio-control` shell destination.
- Default Portfolio selection: `heartbeats`.
- Other view selections: `tasks`, `wishlist`, `agents`, `hosts`, `projects`,
  `documents`, `trajectory`, and `rants`.
- Selecting a native agent/thread from the Portfolio Agents view still opens
  the existing `/$environmentId/$threadId` route in the right pane.

The exact future URL/query shape for the selected Portfolio view is not being
chosen here. The important rule is that the selected view controls the right
pane while the Portfolio list stays in the left pane.

## Why the top bar is suitable

The two buttons are app-level mode switches, so the top bar is a good place
for them. It is visible during normal thread work and keeps the special modes
easy to reach.

The full Portfolio menu does not belong in the top bar. It belongs in the left
pane after Portfolio mode is selected.

The desktop chat header uses a draggable title-bar region in
[ChatView.tsx](../apps/web/src/components/ChatView.tsx). The buttons must be
clickable non-drag controls and must respect the existing sidebar toggle and
macOS window-control spacing.

## Comparison with the existing T3 navigation

The existing T3 pattern is still the default:

- the normal left sidebar owns projects and threads;
- the sidebar footer contains Settings and the current Portfolio Control link;
- the chat header shows current project/thread context;
- native thread links use `/$environmentId/$threadId`.

The relevant source is [AppSidebarLayout.tsx](../apps/web/src/components/AppSidebarLayout.tsx),
[SidebarChrome.tsx](../apps/web/src/components/sidebar/SidebarChrome.tsx), and
[portfolio-control.tsx](../apps/web/src/routes/portfolio-control.tsx).

This design adds two mode switches. It does not replace normal project/thread
navigation or create a second navigation system for ordinary work.

## VoiceTools information architecture

The live VoiceTools page at [Portfolio Control](http://127.0.0.1:8507/portfolio-control)
uses this structure:

```text
Work:       Tasks, Wishlist
Operations: Agents, Heartbeats, Host Health
Plan 544:   Projects, Documents, Trajectory, Rants (Draft)
```

The T3 Portfolio left pane keeps the same destinations, with the requested
order:

```text
Heartbeats
Tasks
Wishlist
Agents
Host Health
──────────────
Projects       Draft / later
Documents      Draft / later
Trajectory     Draft / later
Rants          Draft / later
```

The VoiceTools page currently reads task, wishlist, session-inventory,
Heartbeat, host-health, and peer-status data from its own backend. T3 should
copy the information architecture, not pretend that those VoiceTools records
are already native T3 records.

## Active and selected states

- **Normal mode:** neither special button is selected; the normal T3 sidebar
  and right-pane thread remain active.
- **Agents mode:** `Agents` is highlighted; the left pane shows Agents;
  selected session row is highlighted; the right pane shows that native
  thread.
- **Portfolio mode:** `Portfolio` is highlighted; the left pane shows
  Portfolio destinations; selected destination row is highlighted; the right
  pane shows that view.
- Switching modes changes the left pane. It does not destroy or duplicate the
  current native thread.
- Returning to normal mode restores the normal project/thread list.

## Narrow screens

On a narrow screen:

- keep `Agents` and `Portfolio` as compact top-bar controls when both fit;
- if they do not fit, show one compact mode menu containing those two choices;
- the left pane becomes the existing mobile/sidebar drawer, with its contents
  replaced by Agents or Portfolio destinations while that mode is active;
- selecting an Agent/session closes the drawer and shows the native thread;
- selecting a Portfolio item closes the drawer and shows the selected view;
- normal project/thread navigation continues to use the existing drawer.

Do not move the full Portfolio destination list into the top bar.

## What can be implemented now

Native T3 can provide now:

- Agents mode backed by existing projects and thread shells;
- session cards that open normal native thread routes;
- Portfolio mode and its left-pane destination list;
- Heartbeats-first ordering;
- native Host Health/environment context;
- the current paused Heartbeat status and local native-thread target selector;
- clear Draft labels for later Portfolio sections.

These still need to be ported from VoiceTools:

- authoritative Tasks and Wishlist records, revisions, checklists, and
  receipts;
- Passport and federated agent ownership data;
- live Heartbeat persistence and controls;
- VoiceTools host-health and peer diagnostics;
- Projects, Documents, Trajectory, and Rants data contracts.

Until those contracts move, show `Not connected` or `Draft`. Do not invent
records and do not add a second session registry.

## Deferred future idea

When an agent session appears in the normal left sidebar, its context or
right-click menu may later offer fast actions such as viewing/applying
Heartbeats or jumping to Portfolio views scoped to that project or agent.

This is only a future direction. The exact actions, labels, permissions, and
scope are not defined, and nothing is implemented now.

## Design options

### Option 1 — chosen two-mode left pane

Top-bar buttons switch the left pane between normal T3 navigation, Agents, and
Portfolio. The right pane always shows the selected thread or selected
Portfolio view. This matches the requested interaction model and is the
recommendation.

### Option 2 — separate full-page destinations

Agents and Portfolio would replace the whole page while the normal sidebar
stayed visible. This is simpler to route, but it does not match the requested
left-pane/right-pane flow and gives less space to the native thread.

## Exact next implementation slice

Implement only the chosen mode shell:

1. Add top-bar `Agents` and `Portfolio` buttons outside the draggable region.
2. Add a mode-controlled left pane that can show the native Agents/session
   list or the Portfolio destination list.
3. Make Agent/session selection open the existing native thread route in the
   right pane.
4. Make Portfolio selection change the right-pane view, starting with
   Heartbeats, then Tasks, Wishlist, Agents, Host Health, and the four Draft
   destinations.
5. Restore the normal project/thread list when neither mode is selected.
6. Add narrow-screen drawer behavior and run one focused UI smoke check.

Do not add VoiceTools calls, a database, a session registry, polling, a
scheduler, or any Heartbeat activation.
