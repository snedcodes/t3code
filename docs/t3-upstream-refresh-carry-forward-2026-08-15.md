# T3 upstream refresh carry-forward report

Date: 15 August 2026
Scope: source comparison only; no merge, rebase, reset, branch, worktree,
source edit, app launch, build, package, or install was performed.

## Refresh result

Fetched the configured `upstream` remote only.

| Item | Value |
| --- | --- |
| Upstream branch | `upstream/main` |
| Upstream SHA | `8c628f14993cb159d467e7a0f8c52578dde77005` |
| Upstream commit date | `2026-08-15T05:48:54+03:00` |
| Upstream tag | `v0.0.34-nightly.20260815.1098` |
| Current branch | `sned/t3-reliability-upstream-880` |
| Current HEAD | `83c640a5c2f1d3e269a21a567f78a7016e6e5f84` |
| Merge base | `2d31cb022dee43e5a729273a6936228f30077e29` |
| Current-only commits | `53` |
| Upstream-only commits | `469` |

The existing dirty worktree was unchanged.

## Carry forward now

### 1. Portfolio navigation design

Carry this final file:

```text
docs/t3-portfolio-global-navigation-design.md
```

It describes the chosen two-mode flow: top-bar `Agents` and `Portfolio`
buttons replace the left pane, while the right pane continues to show a
normal native thread or the selected Portfolio view.

Best method: copy the final file manually. The file was created by
`bc28f5add` and revised by `83c640a5c`; cherry-picking only the last commit
will fail because the file did not exist before the first commit.

### 2. Useful Portfolio implementation pieces

The current implementation is useful source material, but it should not be
cherry-picked as a complete feature. The chosen two-mode design is different
from the current full-page Portfolio route.

Preserve these pieces for manual reimplementation:

| Source | Useful part | Recommendation |
| --- | --- | --- |
| `apps/web/src/portfolioHeartbeat.ts` | Pure paused Heartbeat model and active native-thread selector | Manually copy after checking the upstream settled-thread export. |
| `apps/web/src/portfolioHeartbeat.test.ts` | Focused tests for the pure model and selector | Manually port with the new mode tests. |
| `apps/web/src/routes/portfolio-control.tsx` | Native project/thread grouping, scoped thread links, Host Health and paused Heartbeat presentation | Extract only the needed parts; do not carry the 592-line route wholesale. |
| `apps/web/src/components/sidebar/SidebarChrome.tsx` | Existing Portfolio footer link | Optional reference only; the new top-bar mode buttons are the chosen entry point. |

The source commits behind these pieces are:

```text
1f73754a7  Portfolio Control sidebar entry
891487e99  initial Portfolio Control route
ba4202540  native Agent/thread links
735db09f0  paused native Heartbeat foundation
a504b02a2  active native Heartbeat target selection
```

Recommendation: manually reimplement the selected pieces on top of the new
upstream shell. Do not cherry-pick the sequence. Upstream has large changes in
`ChatView.tsx`, `SidebarChrome.tsx`, and `routeTree.gen.ts`; the generated route
file must be regenerated on the new base rather than copied.

## Likely needed later

### VoiceTools Portfolio and Heartbeat port

No current T3 commit ports the VoiceTools source of truth. The later work will
need a new design and implementation against the VoiceTools contracts for:

- Tasks and Wishlist records, revisions, checklists, and receipts;
- Passport and host ownership;
- live Heartbeat settings and receipts;
- Host Health and peer diagnostics;
- Projects, Documents, Trajectory, and Rants.

Do not carry VoiceTools data, JSON stores, API calls, or scheduler code into the
new worktree by default. The current native T3 model is the safe first slice.

### Native dispatch

The native sideband work is a separate later stream. Its main source files are:

```text
apps/server/src/cli/sideband.ts
apps/server/src/cli/sidebandSsh.ts
apps/server/src/cli/sideband.test.ts
apps/server/src/cli/sidebandSsh.test.ts
apps/server/src/bin.ts
apps/server/src/auth/http.ts
apps/server/src/auth/utils.ts
packages/contracts/src/auth.ts
packages/contracts/src/environmentHttp.ts
```

Relevant commits are `0551ad327`, `0b8bdef85`, `656e9026b`, `e37fcf5ed`,
`3d68627f5`, `ba8f77bea`, and `ae218a149`. These commits form a dependent
series and touch authentication, CLI registration, SSH behavior, and shared
contracts. Upstream has moved substantially since they were written.

Recommendation: leave them behind for this new worktree and re-compare them
when native dispatch becomes the next feature. If still needed, manually
reimplement or cherry-pick as one reviewed series after an API comparison;
do not cherry-pick one sideband commit by itself.

## Do not carry by default

Leave these experiments and their supporting files behind unless a current
feature proves it needs one of them:

- Operational launcher/app and durable Node work:
  `65cc9d56b`, `69ec1d347`, `c223d9106`, `5a9105d37`, `b0512c597`,
  `0268fe428`.
- Selected-thread import, retention, and recovery tooling:
  `617d2e2c8`, `c831bb808`, `9f55fdb6d`, `bf0bfc9bc`, `16b20669d`.
- Release and cross-host deployment records:
  `c904b2a5e`, `890f3f7c9`, `9df4b305a`, `d48e00470`.
- The remaining reliability, handover, and historical plan commits in the
  current-only set.

These files either change runtime ownership, add migration/storage behavior,
or describe an old release process. They are not needed to build the next
Portfolio navigation slice.

## Conflicts and dependencies

- `apps/web/src/components/ChatView.tsx` differs heavily between the current
  branch and upstream. Do not transplant top-bar code by cherry-pick; add the
  two mode buttons manually to the refreshed header.
- `apps/web/src/components/sidebar/SidebarChrome.tsx` has upstream changes and
  current fork changes. Use the refreshed file as the base.
- `apps/web/src/routeTree.gen.ts` differs and is generated. Add the new route,
  then regenerate it on the refreshed base.
- `apps/web/src/routes/portfolio-control.tsx` and the Heartbeat files are new
  to the fork, so they have no direct upstream file conflict. They still need
  manual adaptation to the chosen left-pane mode and current upstream types.
- The current branch contains a large unrelated reliability delta. Do not use
  a broad merge or a full-branch cherry-pick to bring Portfolio work forward.

## Recommended next action

Create the clean `t3-snedcodes-dev` worktree from refreshed `upstream/main`,
then manually implement the first vertical slice from the design:

1. Add top-bar `Agents` and `Portfolio` mode buttons.
2. Make the left pane switch between normal T3 navigation, native Agents, and
   Portfolio destinations.
3. Open selected native sessions in the existing thread route.
4. Show Portfolio views in the right pane, starting with paused Heartbeats.

Use the final design file and the small native Heartbeat/Agent pieces above as
reference. Do not add VoiceTools calls, storage, polling, a scheduler, or
Heartbeat activation in this slice.
