# 21. Sned Visible Session Orchestration

## Purpose

Create a safe path for VoiceTools or another local agent controller to create T3-visible sessions programmatically.

The immediate target is not to replace the T3 UI. The target is a supported local orchestration surface that can create the same durable project/thread/session state that the T3 UI creates when the user starts a new agent session.

## Current Context

The user currently has T3 Code `0.0.23` installed at:

```text
/Users/snedmusic/Applications/T3 Code (Alpha).app
```

The forked source repo is:

```text
origin: https://github.com/snedcodes/t3code.git
upstream: https://github.com/pingdotgg/t3code.git
branch: sned-visible-session-orchestration
```

The fork currently tracks upstream `main`, which is at the `0.0.24` release line. The installed app is older than the fork base.

## Safety Model

Do not patch the installed Electron bundle directly.

Keep the installed app as the working daily-driver until a source-built custom version is proven.

Before any experiment that writes to real T3 user data, back up:

```text
/Users/snedmusic/Library/Application Support/t3code
/Users/snedmusic/.t3
/Users/snedmusic/.codex
```

Prefer early experiments against copied/test user data.

## Upstream/Fork Strategy

Use both a fork and branches.

- `upstream` points to the official public T3 repo.
- `origin` points to the `snedcodes` fork.
- `main` tracks the clean fork copy of upstream.
- feature branches hold Sned/VoiceTools custom work.

Recommended branch:

```text
sned-visible-session-orchestration
```

Keep custom patches small and documented so upstream updates can be pulled into the fork and the Sned branch can be rebased or merged with limited conflict risk.

## Initial Source Findings

The repo already has orchestration contracts and server routes relevant to this work.

Key contract files:

```text
packages/contracts/src/orchestration.ts
packages/contracts/src/rpc.ts
```

Key server files:

```text
apps/server/src/ws.ts
apps/server/src/orchestration/http.ts
apps/server/src/server.ts
apps/server/src/serverRuntimeStartup.ts
apps/server/src/cli/project.ts
apps/server/src/orchestration/
```

Important command types already exist:

- `project.create`
- `thread.create`
- `thread.turn.start`

Important RPC names already exist:

- `orchestration.dispatchCommand`
- `orchestration.getTurnDiff`
- `orchestration.getFullThreadDiff`
- `orchestration.replayEvents`
- `orchestration.subscribeShell`
- `orchestration.subscribeThread`

There also appear to be HTTP orchestration routes in the server layer, including a dispatch route and snapshot route. This may mean the first implementation can call an existing local HTTP route rather than adding a new one.

## Required Reverse Engineering

1. Determine how the desktop app starts the server and which local origin/port it exposes.
2. Determine authentication requirements for local HTTP orchestration dispatch.
3. Capture the exact command sequence emitted by the UI when creating:
   - a new project
   - a new thread
   - a first turn in an existing project
   - a first turn with bootstrap `createThread`
4. Confirm whether `thread.turn.start` with bootstrap `createThread` is sufficient for one-call session creation.
5. Confirm how model selection, runtime mode, interaction mode, branch, worktree path, and title seed are represented.
6. Confirm when provider runtime state is created and when the session becomes visible in projections.
7. Confirm how T3 stores and indexes user data for projects and threads.
8. Confirm how VoiceTools should refresh or detect the new session.

## Candidate Implementation Paths

### Path A: Use Existing Local HTTP Dispatch

If `apps/server/src/orchestration/http.ts` exposes a safe local dispatch route, build a small VoiceTools/T3 integration that calls it with the same payload the UI uses.

Benefits:

- smallest T3 source change
- easiest to preserve across upstream updates
- likely works with official T3 if route is already present

Risks:

- route may require auth or internal-only assumptions
- route may not expose all bootstrap capabilities
- route may not be intended as a stable public API

### Path B: Add A Dedicated Local Create-Session Endpoint

Add a narrow local endpoint that accepts:

- workspace path
- project title
- thread title
- initial prompt
- provider/model selection
- runtime mode
- interaction mode

Then it dispatches existing orchestration commands internally.

Benefits:

- clean stable surface for VoiceTools
- easy to document and test
- avoids raw DB writes

Risks:

- source patch must be maintained across upstream updates
- must handle local auth and safety carefully

### Path C: Add A CLI Command

Add a server-side or app-level CLI command such as:

```text
t3 create-session --workspace /path --title "Agents Dev Guidelines" --prompt "..."
```

Benefits:

- easy for agents/scripts to call
- avoids browser UI automation
- can be tested without the phone app

Risks:

- may need to locate and communicate with the running desktop server
- may require a separate server bootstrap path if T3 is not already running

## Non-Goals

- Do not write directly to T3 SQLite/projection tables.
- Do not mutate live user data before backup and test-profile proof.
- Do not replace the existing T3 UI flow.
- Do not build broad multi-agent orchestration before visible single-session creation is proven.

## First Milestone

Prove one visible session can be created in a test profile or safe live profile using orchestration dispatch, with no direct DB mutation.

Minimum proof:

1. T3 visible thread appears in the app.
2. The thread has the requested human-readable title.
3. The thread is bound to the requested workspace path.
4. The initial prompt is delivered to the provider session.
5. VoiceTools can detect the new T3 session after refresh.

## Validation Gates

For code changes in this repo, run:

```text
bun fmt
bun lint
bun typecheck
```

For docs-only planning, inspect diffs and keep the branch pushed.

For runtime experiments, record:

- source branch and commit
- T3 app version or dev server command
- user-data profile used
- exact orchestration payload
- visible T3 result
- VoiceTools detection result

