# Prepare a Dev upstream upgrade

The root release owner maintains `scripts/t3-dev-release-manifest.json` with the accepted fork baseline and retained capabilities for `desktop` and `mobile-vps`. Preparation merges an exact official release into that baseline in a new worktree. It does not require a clean developer checkout or move its branch.

Inspect a planned upgrade using Node 24 and Git:

```powershell
node scripts/prepare-dev-upgrade.mjs --line desktop --release v0.0.45 --workspace C:/Users/Administrator/src/t3-desktop-next --inspect
```

Choose the actual desired official tag and a new absolute workspace outside the checkout and live `.t3`, `.t3-dev`, and `.t3-private-context` directories. `--repo <checkout>` and `--manifest <path>` override the default checkout and its manifest. Inspection reads local metadata only; it does not fetch, create worktrees, build, or start a runtime. The capability list is a retention requirement, not proof that the candidate implements it.

The root owner runs the same command without `--inspect` to prepare the candidate. If the accepted fork commit is absent, preparation fetches its named branch from configured `origin`. That commit must be reachable from the recorded local or origin branch. Preparation fetches only the requested official tag from `https://github.com/pingdotgg/t3code.git` into a unique task ref, then creates a new branch/worktree at the accepted fork commit and runs `git merge --no-ff --no-commit` with the resolved official commit. Git hooks, autostash and automatic reuse of old conflict resolutions are disabled for preparation. Existing destinations are never overwritten or deleted. No feature patches are skipped or reset.

The JSON receipt identifies both source commits, the workspace/branch, required retained capabilities and pending runtime proof. `candidate-needs-review` leaves a clean merge uncommitted; `needs-resolution` leaves conflict files intact and lists unmerged paths. Resolve conflicts in that worktree, review the combined changes against the retained behavior, perform focused checks and commit through the root integration owner. An already-integrated release can produce a candidate without `MERGE_HEAD`; review its source identity rather than expecting another merge commit. Other preparation failures leave any created candidate intact for inspection; the command does not clean it up or attempt recovery.

This command performs no install, build, deployment, profile transfer or state migration. Desktop and native mobile builds remain Mac-only. JavaScript OTA can deliver changes compatible with the installed native runtime; changed native modules, permissions or foreground-service behavior require a new Android APK. A private desktop update feed is not implemented; candidate preparation does not create one or alter the signed installed app.

Conflict preparation exits with code 2 so a later build command cannot mistake unresolved source for a completed merge. The worktree and conflicts remain available for ordinary resolution; other preparation failures exit with code 1.

Before activation, the root owner assesses client/server protocol and persisted-state compatibility. An older binary may not safely read state after an upgrade. A fallback may require a consistent pre-upgrade state snapshot taken through the existing owner procedure before activation. Preparation takes no live database snapshot and never automatically restores a database. Preserve the installed/runtime owner, profile and source lineage until an explicit handover; only one owner may use the live profile.
