# T3 Build Coordinator — comprehensive session handoff

Date: 24 August 2026  
Incoming visible role/title: `T3 Build Coordinator`  
Outgoing visible role/title: `T3 Portfolio Control Draft Builder 17 AUG`  
Project: `T3 Code Reliability`  
Repository: `/Users/snedmusic/snedcodes/t3-snedcodes-dev`  
Status: `ready_with_caveats`  
Handoff type: durable context, architecture, operations, source-state, and
execution handoff; no runtime or external action is authorized merely by this
document

## 1. Executive brief

The user is building T3 into the primary control system for a multi-computer
agent portfolio spanning:

- a MacBook used as the main daily operator surface;
- a Windows laptop;
- a Windows VPS; and
- the T3 phone application.

The central product outcomes are:

1. reliable native T3 agent-to-agent messaging across all computers;
2. retirement of VoiceTools from ordinary message delivery;
3. native Portfolio Heartbeats with one explicit VPS owner;
4. native Tasks and Wishlist records available across desktop/web/mobile;
5. useful Rotations and context-health controls;
6. environment-scoped context, transcript, and storage monitoring;
7. safe, explicit T3/Codex retention and compaction rather than improvised
   filesystem or SQLite cleanup;
8. preservation and later migration of useful VoiceTools TTS and realtime
   voice-assistant capabilities; and
9. stable source development that does not repeatedly terminate the user's
   active Mac agent sessions.

The highest-priority outcome is messaging. Native T3 sends have already been
proven. Do not place a sideband command, VoiceTools repair, Portfolio feature,
new broker, or another proof framework in front of using that working native
path.

The current source-development operating decision is:

- Mac packaged Alpha is the stable daily owner of the real Mac profile;
- the phone connects to Mac Alpha;
- source changes that may rebuild/restart T3 are developed and exercised on
  Windows VPS Dev first;
- Mac Dev, when needed, uses a separate profile and connects back to Alpha as
  a remote environment; and
- native T3, not VoiceTools, is the destination messaging architecture.

## 2. How the successor should establish truth

This session contains a large amount of runtime history. Treat evidence in
this order:

1. current repository source and current Git state;
2. the authoritative 23 August consolidation plan and architecture decision;
3. current operating runbooks and focused handoffs;
4. committed implementation receipts and tests;
5. transcript reports and screenshots as context only; and
6. old plans only as historical design evidence.

Do not present a transcript statement about a running process, paired client,
current port owner, provider status, or remote host revision as present-tense
runtime proof without rechecking the supported surface.

### 2.1 Current document authority

Read in this order:

1. [Native Messaging, Session Health, Portfolio, and VoiceTools Retirement Plan](../t3-native-messaging-portfolio-consolidation-plan-2026-08-23.md)
   — the single current start-to-finish authority.
2. [Portfolio Control architecture decision](../t3-portfolio-control-architecture-decision-2026-08-19.md)
   — durable environment, ownership, messaging, Heartbeat, and storage
   boundaries.
3. [Native messaging behaviour guide](../t3-native-agent-messaging-behaviour-guide-2026-08-22.md)
   — the proven send procedure and behaviours that helped or obstructed it.
4. [T3 lifecycle, ports, profiles, and messaging runbook](../t3-portfolio-control-t3-lifecycle-and-messaging-runbook-2026-08-22.md)
   — current Alpha/Dev operating model plus preserved historical launch
   context.
5. [Focused current-work index](../t3-portfolio-control-current-work-index-2026-08-17.md)
   — compact routing to relevant evidence.

Supporting implementation evidence, not current authority:

- [Portfolio Control execution plan](../t3-portfolio-control-execution-plan-2026-08-19.md)
  — detailed implementation receipt ledger; never use its dated “next actions”
  to override the consolidation plan.
- [Historical Heartbeat-first roadmap](../t3-portfolio-heartbeat-first-roadmap-2026-08-17.md)
  — contains the superseded VoiceTools-first ownership plan. Use only to
  extract legacy lifecycle/import fields; do not execute its owner, scheduler,
  messaging, or build sequence.

Focused worker entry points:

- [Tasks Foundation worker handoff](t3-portfolio-control-tasks-foundation-worker-2026-08-22.md)
- [Rotations View Builder handoff](../t3-portfolio-rotations-view-builder-handoff-2026-08-22.md)
- [Multi-computer connectivity handoff](t3-portfolio-control-multi-computer-connectivity-handoff-2026-08-21.md)

Storage policy authority and supporting evidence:

- [T3/Codex storage retention and safe cleanup](../../../agents-dev-guidelines/standards/2026-08-23_t3_codex_storage_retention_and_safe_cleanup.md)
  — current reusable policy.
- [Portfolio Git and session storage recovery](../../../agents-dev-guidelines/DOCS/DEVELOPMENT_PLANS/014_PORTFOLIO_GIT_AND_SESSION_STORAGE_RECOVERY_2026-08-13.md)
  — dated measurements and recovery receipts, not current sizes or work order.
- [Storage implementation review brief](../../../agents-dev-guidelines/prompts/2026-08-23_t3_codex_storage_retention_implementation_review.md)
  — focused read-only worker brief, not general operating authority.

### 2.2 Documents that are deliberately demoted

Several older documents accurately preserve receipts but contain obsolete
operating assumptions. In particular:

- old Mac Dev rows may show port `3773` and the live profile;
- old Heartbeat plans may make Mac VoiceTools the initial owner;
- old Tasks/Rotations worker advice may propose another read-only preview as
  the next slice; and
- old central coordination guidance may mandate VoiceTools.

Those passages are historical. They do not override the current Alpha-on-3773,
isolated-Dev-on-3774, VPS-first, native-messaging plan.

## 3. Repository and Git state at handoff creation

Verified read-only on 24 August 2026:

```text
branch: sned/t3-portfolio-control-dev-2026-08-21
HEAD:   03ceb09a8bc67841300028e111a31c3fae9dbe24
title:  docs(portfolio): add rotation and task worker handoffs
remote: origin/sned/t3-portfolio-control-dev-2026-08-21 at the same commit
```

Current working-tree changes before adding this handoff:

```text
 M docs/handoffs/t3-portfolio-control-tasks-foundation-worker-2026-08-22.md
 M docs/t3-portfolio-control-architecture-decision-2026-08-19.md
 M docs/t3-portfolio-control-current-work-index-2026-08-17.md
 M docs/t3-portfolio-control-execution-plan-2026-08-19.md
 M docs/t3-portfolio-control-t3-lifecycle-and-messaging-runbook-2026-08-22.md
 M docs/t3-portfolio-heartbeat-first-roadmap-2026-08-17.md
 M docs/t3-portfolio-rotations-view-builder-handoff-2026-08-22.md
?? docs/t3-native-agent-messaging-behaviour-guide-2026-08-22.md
?? docs/t3-native-messaging-portfolio-consolidation-plan-2026-08-23.md
```

This handoff itself is an additional untracked document until committed.

These are a coherent documentation-consolidation tranche from the outgoing
session. They are not disposable debris. Do not reset, clean, overwrite, or
silently mix them with unrelated source work. No source-code file was dirty in
the current worktree when this handoff was started.

The documentation tranche has passed `git diff --check`. It has not been
committed by the outgoing coordinator.

## 4. Desired end-state architecture

### 4.1 One native T3 execution model

Each computer is an independent T3 environment that owns its own:

- filesystem and projects;
- T3 home and database;
- provider credentials and provider processes;
- local threads and turns;
- execution receipts; and
- host-local context/session/storage measurements.

The user should be able to select an exact environment, project, and thread
from Mac or mobile and operate it using T3's existing connection runtime.

The canonical send chain is:

```text
T3 client or agent shell
  -> exact environment
  -> exact project
  -> exact existing thread
  -> native thread.turn.start
  -> dispatch receipt
  -> optional target-thread readback
```

Portfolio is a control/read surface over native identities and records. It
must not become a second project/thread database, message bus, session
registry, scheduler per host, or VoiceTools-shaped broker.

### 4.2 The three connectivity layers

Keep these separate:

| Layer                  | Purpose                                                  | Explicit non-purpose                                                  |
| ---------------------- | -------------------------------------------------------- | --------------------------------------------------------------------- |
| Native T3 environments | Projects, threads, turns, receipts, remote agent control | Does not grant Git or shell administration                            |
| GitHub                 | Source and documentation synchronization                 | Does not copy T3 homes, databases, threads, providers, or credentials |
| Tailscale + OpenSSH    | Stable private reachability and machine administration   | Does not replace T3 environment identity or own a service lifecycle   |

Do not rebuild SSH because T3 pairing fails. Do not change Git credentials
because a provider times out. Do not restart T3 because VoiceTools dispatch is
down. Diagnose the owning layer.

### 4.3 Canonical owners

- Mac Alpha owns the user's live Mac T3 profile and daily threads.
- Each remote Alpha/Dev environment owns its own local threads.
- Windows VPS source T3 is the intended direct initial and long-lived owner of
  canonical Portfolio/Heartbeat records and the eventual single Heartbeat
  scheduler.
- Mac, phone, and Windows laptop are clients/controllers of that owner.
- Mac Heartbeat ownership is a later recovery/cutover capability, not a
  prerequisite transfer ceremony.

## 5. Current operating topology

### 5.1 Mac packaged Alpha

Current operating decision:

```text
role:       stable daily live environment
home:       /Users/snedmusic/.t3
port:       3773
environmentId reported in successful tests:
            4589bff7-63f7-431b-a92f-4d291f914de3
```

Alpha contains the live Mac projects, threads, preferences, and provider
sessions. The T3 phone app is reported paired to this environment.

The packaged application on disk has historically been named:

```text
/Users/snedmusic/Applications/T3 Code 0.0.32.app
```

Transcript/runtime inspection reported that the package itself identified as
server version `0.0.33`; the filename was stale. Recheck package metadata if
the exact installed version matters.

Launch packaged Alpha normally from Finder. During one recovery, inherited
Electron/Dev environment variables caused a blank or incorrect launch. The
bounded cold-launch workaround was:

```bash
env -u ELECTRON_RUN_AS_NODE \
  -u NODE_ENV \
  -u VITE_DEV_SERVER_URL \
  -u T3CODE_HOME \
  -u T3CODE_PORT \
  -u VITE_HTTP_URL \
  -u VITE_WS_URL \
  open -na "/Users/snedmusic/Applications/T3 Code 0.0.32.app"
```

That command is a troubleshooting fallback, not the desired permanent launch
experience. Do not rewrite profiles or encrypted catalogs merely because
Finder launch behaves differently; inspect the actual environment and process
ownership first.

### 5.2 Mac source Dev

Current operating decision:

```text
role: stable isolated source client/test environment when needed
home: /Users/snedmusic/snedcodes/t3-snedcodes-dev/.t3-client
port: 3774
```

Recommended source launch pattern:

```bash
cd /Users/snedmusic/snedcodes/t3-snedcodes-dev
export PATH="/Users/snedmusic/tools/node24/bin:$PATH"
./node_modules/.bin/vp run dev:desktop \
  --home-dir /Users/snedmusic/snedcodes/t3-snedcodes-dev/.t3-client \
  --port 3774
```

Mac Dev must pair with Mac Alpha and select Alpha when the user wants the same
live agents and threads. Profiles are not merged. Never point Mac Dev at
`/Users/snedmusic/.t3` while Alpha owns it.

This separation is the resolution to the apparent conflict between:

- the requirement that Alpha and Dev can both access the same working agents;
  and
- the rule that two Electron identities/servers must not write the same live
  T3 home simultaneously.

### 5.3 Windows VPS

Durable connectivity handoff reports:

```text
host identity: WIN-HOK834JECO0
active checkout:
  C:\Users\Administrator\src\t3-snedcodes-dev-git
Dev home:
  C:\Users\Administrator\.t3-dev
Dev port:
  3774
Dev web port:
  5733
lifecycle owner:
  Windows Task Scheduler task "T3 Code Source Dev"
Alpha:
  separate home, port 3773
Tailscale address used in earlier proof:
  100.118.254.22
```

The VPS is the preferred source-development host for T3 changes that may
rebuild, restart, or crash Dev. Verify current task, revision, and port owner
before changing it; the lines above are durable setup receipts, not a claim
that the process is running now.

### 5.4 Windows laptop

Durable connectivity handoff reports:

```text
host identity: DESKTOP-NPBN95R
active checkout:
  C:\Users\snedd\src\t3-snedcodes-dev-git
Dev home:
  C:\Users\snedd\.t3-dev
Dev port:
  3774
Dev web port:
  5733
lifecycle owner:
  Windows Task Scheduler task "T3 Code Source Dev" at user logon
Alpha:
  separate home, port 3773
Tailscale address used in earlier proof:
  100.107.147.25
```

### 5.5 Phone/mobile

The phone is reported successfully connected to Mac Alpha. The stable mental
model is:

- the phone connects to an environment, not to a global cloud copy of every
  thread;
- selecting Mac Alpha gives access to Mac Alpha's projects and threads;
- a separate Dev environment is a separate target;
- Dev sees Alpha's live threads by pairing to Alpha, not by sharing Alpha's
  profile; and
- future Portfolio views should aggregate selected native environments rather
  than silently merge their databases.

### 5.6 SSH and Git status

The connectivity handoff records all six authenticated SSH directions as
proven:

```text
Mac -> VPS
Mac -> Windows laptop
VPS -> Mac
VPS -> Windows laptop
Windows laptop -> Mac
Windows laptop -> VPS
```

Stable aliases include:

```text
agent-win-vps
agent-win-laptop
agent-macbook
```

Windows `sshd` was configured for automatic startup. Recheck a failing
direction before declaring permanent connectivity broken.

The GitHub user is `TheVolumeGrid`; `snedcodes` is the organization. The VPS
source checkout has a write-capable user route named
`github-thevolumegrid-vps-rsa`. The legacy VoiceTools deploy-key route remains
separate and repository-scoped. Git source synchronization does not imply
shared T3 runtime state.

## 6. Native agent-to-agent messaging

### 6.1 The settled decision

Native T3 sends already work. Sideband is not required. VoiceTools is not
required. No new backend is required.

The immediate operating instruction is:

```text
Use native T3 dispatch only.

Resolve the exact environment, project, and existing thread from live T3.
Do not use VoiceTools, the VoiceTools bridge, /api/codex, host_id routing,
a guessed thread ID, or title-only dispatch.
Send once.
Report the dispatch receipt and, when required, target-thread readback.
```

### 6.2 What agents actually call

Some agents became stuck because they searched for a model tool literally
named `thread.turn.start`. That is the wrong abstraction. The working tool
chain is:

```text
functions.exec
  -> tools.exec_command
  -> T3 CLI short-lived auth session
  -> GET /api/orchestration/snapshot
  -> POST /api/orchestration/dispatch
  -> type: thread.turn.start
  -> GET target thread detail when readback is required
```

The command type is a native T3 payload, not necessarily a separately listed
model tool.

The smallest documented authentication window is:

```bash
t3 auth session issue \
  --base-dir /Users/snedmusic/.t3 \
  --ttl 2m \
  --json
```

Use the bearer token against:

```text
GET  http://127.0.0.1:3773/api/orchestration/snapshot
POST http://127.0.0.1:3773/api/orchestration/dispatch
GET  http://127.0.0.1:3773/api/orchestration/threads/<raw-thread-uuid>
```

Resolve title to the live raw UUID, then dispatch by UUID. Do not add a
`t3-thread:` prefix. Reuse one short-lived bearer token for an active
coordination window rather than issue/revoke on every message.

For another host, use that host's reachable T3 origin and matching supported
auth route. The owner of the target environment remains the authority.

See the behaviour guide for the current JSON payload and exact procedure.

### 6.3 Proven local native messaging receipt

The durable behaviour guide records a successful Alpha test:

```text
source: Advance Multi-Cell Execution Control 21 Aug
target: Execution Control Assistant 21 Aug
environment: MacBook Pro (2), Alpha, port 3773
environmentId: 4589bff7-63f7-431b-a92f-4d291f914de3
projectId: e794e2d8-bff1-4cd1-805c-669b289be4db
threadId: 981386ed-88c9-47c0-822e-6441b5d3ec8d
dispatch sequence: 853623
commandId: b8607d4b-95e2-4450-87cd-2da83bec1431
messageId: e8ebf2c8-4374-4793-a260-fdf2b27f4a35
reply: NATIVE_EXEC_DISPATCH_ACK
```

An earlier test also successfully delivered to the outgoing coordinator and
received `NATIVE_T3_ACK`. These receipts prove the path; they do not eliminate
the need to resolve current target IDs afresh.

The user also successfully sent ordinary native T3 messages from Mac to the
Windows laptop, and the repository records an earlier VPS native target proof.
The current remaining fleet evidence is one reverse-direction message from
each Windows host to Mac using the same current native procedure.

### 6.4 Sideband clarification

Historical fork commits implement `sideband-send` and
`sideband-send-ssh` on branch `sned/t3-reliability-upstream-880`, beginning at
`0551ad327` and including a live-server auth repair at `ae218a149`.

That code is optional reference only. It is not the messaging architecture and
not a prerequisite. Current T3 does not expose the historical
`/api/auth/local-session` endpoint and the branch has significantly diverged.
Do not block native sends or VoiceTools retirement on restoring/cherry-picking
that command. A small first-class helper may eventually package the proven
procedure for convenience after current fleet sends work.

### 6.4a Native visible-worker creation proof

Native T3 also creates visible workers. On 24 August, the outgoing coordinator
checked the live `T3 Code Reliability` project for an exact-title duplicate,
sent one native `thread.create`, then sent the initial instructions with one
native `thread.turn.start`. The resulting visible `T3 Build Coordinator`
thread read back with the exact project, title, first message, and a starting
Codex session.

```text
threadId:               665fdd70-dcec-4b18-924c-18a60b095270
thread.create sequence: 886311
turn.start sequence:    886322
```

No VoiceTools creation wrapper, hidden sub-agent, browser workaround, or
direct database write was used. Preserve the invariant: check the live project
for an exact-title duplicate, create once by native raw identity, seed once,
and reconcile the live snapshot before any retry.

### 6.5 Messaging behaviours that caused delay

Avoid repeating these patterns:

- declaring native dispatch unavailable because no dedicated model tool is
  listed;
- trying unsupported `/api/auth/local-session` and treating its `404` as
  proof that T3 messaging is absent;
- switching to VoiceTools after a native mistake;
- routing by stale `host_id`, raw legacy key, guessed prefix, or ambiguous
  title;
- creating temporary scripts and cleanup ceremony for a simple current API
  call when an existing shell path works;
- issuing and revoking a bearer token for every individual message;
- restarting T3 or VoiceTools to fix an agent's misunderstanding of the API;
- repeating a dispatch when its result is uncertain before readback; and
- continuing validation after the dispatch and target reply are both present.

### 6.6 Central standards contradiction

The Agents Dev Guidelines repository currently contradicts itself:

- its root `AGENTS.md` and `CURRENT.md` still say VoiceTools is the live
  coordination, identity, route-health, transcript, dispatch, and visible
  creation authority; while
- its current native T3 sideband standard says VoiceTools is optional and must
  not be the ordinary message broker.

This conflict has caused agents to fall back to VoiceTools or refuse native
sends. Update the central `AGENTS.md`, `CURRENT.md`, and native messaging
standard as one coherent tranche, following that repository's backup,
changelog, and trajectory requirements. Then propagate the resolved native
instruction to relevant target repositories. Do not patch just one central
file and leave another contradictory instruction current.

## 7. VoiceTools retirement and preservation boundary

### 7.1 What is being retired first

VoiceTools must stop being used for ordinary agent messages. Specifically,
retire dependence on:

- the VoiceTools bridge as a normal T3 messaging prerequisite;
- `/api/codex` messaging routes;
- `host_id`-based delivery;
- title-first VoiceTools send scripts for new ordinary T3 sends;
- VoiceTools as a Portfolio owner; and
- VoiceTools as a fallback whenever an agent misuses native T3.

### 7.2 What must be preserved temporarily

Do not delete the VoiceTools repository/runtime before inventory and migration
of:

- TTS capability;
- realtime voice-assistant sessions/functions;
- useful audio/voice configuration;
- selected Heartbeat definitions and lifecycle semantics;
- selected Task/Wishlist records;
- useful migration evidence and receipts; and
- any phone/voice functions that still lack a native T3 replacement.

Retirement sequence:

1. obtain one current native reverse-direction receipt from each Windows host;
2. freeze a named recoverable VoiceTools source/data snapshot;
3. change active standards to native T3 only;
4. add/enable a VoiceTools switch that rejects new message dispatch while
   retained voice/read-only functions remain available;
5. remove the bridge from normal T3 messaging startup/health expectations;
6. port retained capabilities into T3-owned interfaces; and
7. remove remaining retired message code only after retained-feature decisions
   are closed.

Do not make VoiceTools deletion a prerequisite for native messaging. Stop
using it as a sender first.

## 8. Why Mac development was moved to the VPS

The user repeatedly lost active work because source Dev rebuilt, restarted, or
crashed on the same Mac being used to coordinate many agents. Reported failure
modes included:

- port `3773` already in use by another Alpha/Dev backend;
- repeated backend restart loops after `EADDRINUSE`;
- invalid environment credentials when a Dev window attached to the wrong
  backend/profile;
- a malformed `EnvironmentHttpApi` contract chain causing Babel failure;
- missing Heartbeat contract references causing an Electron main-process
  crash;
- dynamic import failures when opening image preview;
- equivalent failures when opening diffs;
- an Electron `EPIPE`/parent-process error;
- missing built `dist-electron/main.cjs` during an incomplete rebuild;
- blank Alpha shells or missing projects after Dev/Alpha profile and Electron
  environment contamination; and
- source reloads terminating provider/agent work that the user was actively
  relying on.

The current safety/operating decision is not to stop source development. It is
to move ordinary restart-prone source work to VPS Dev, verify one realistic
use there, then promote source through Git.

### 8.1 Current stability work

The VPS Dev stability lane should:

1. reproduce/fix image-preview dynamic-import failure;
2. reproduce/fix diff-preview failure;
3. repair the related Electron `EPIPE`/parent-death path where source evidence
   confirms it;
4. validate the already-implemented native worker session Stop control;
5. run one representative image preview and one representative diff in the
   VPS Dev client; and
6. push the focused source changes before any Mac Dev promotion.

Do not restart Mac Alpha as part of this lane.

### 8.2 Native worker Stop control

Commit `a8c74540b` (`feat(web): add native worker session stop control`) is in
the current branch. Source uses native `thread.session.stop`; this is distinct
from merely interrupting a single turn and from killing provider processes by
pattern.

The remaining task is realistic VPS Dev validation and later promotion—not a
second Stop architecture.

## 9. Current Portfolio feature state

### 9.1 Foundation already present

Committed history and current source contain:

- Agents and Portfolio navigation;
- native environment/project/thread targets;
- Heartbeats-first Portfolio presentation;
- Host Health/environment readiness display;
- Help and Workflows catalog;
- Storage destination placeholder;
- native thread opening and bounded ordinary message controls;
- Heartbeat target, paused draft, lifecycle, dispatch preparation, receipt,
  owner, transfer-decision, and transfer-preview seams;
- server owner read/claim/receipt/transfer endpoints;
- shared web/mobile owner loaders;
- Task and Wishlist contracts and tests;
- read-only Rotations rows, ordering/grouping, context telemetry, authority
  resolution, role/standards links, and prompt preview;
- mobile Portfolio target selection and owner readback; and
- native worker session Stop control.

Important current source paths include:

```text
packages/contracts/src/portfolio.ts
packages/contracts/src/environmentHttp.ts
packages/client-runtime/src/state/portfolio.ts
packages/client-runtime/src/state/portfolioHeartbeatOwnerHttp.ts
apps/server/src/portfolio/
apps/server/src/cli/portfolio.ts
apps/web/src/components/PortfolioModeNavigation.tsx
apps/web/src/portfolioHeartbeat*.ts
apps/web/src/portfolioRotation*.ts
apps/web/src/portfolioContextHealth.ts
apps/web/src/lib/contextWindow.ts
apps/mobile/src/features/portfolio/PortfolioRouteScreen.tsx
apps/mobile/src/state/portfolio.ts
```

### 9.2 Heartbeats: what exists and what does not

Exists:

- exact `{environmentId, projectId, threadId}` target identity;
- owner roles/readback and initial claim;
- owner epoch/revision/freshness concepts;
- receipt types;
- paused lifecycle and stop conditions;
- bounded native turn preparation and dispatch seam;
- staged owner transfer models and endpoints; and
- `PortfolioHeartbeatRecord` and records-readback contracts.

Still missing as a complete product:

- canonical owner-backed Heartbeat record persistence/read model through the
  full server/client/UI path;
- useful owner-scoped list/detail UI;
- selected VoiceTools definitions imported once as paused native records;
- one current manual native Heartbeat run with persisted truthful readback;
- one VPS-owned scheduler; and
- production-quality pause/stop visibility across web/mobile.

The direct initial owner should be VPS T3. Do not invent a Mac-to-VPS transfer
ceremony when no current native owner needs transferring.

### 9.3 Tasks and Wishlist

The contract foundation is implemented in:

```text
packages/contracts/src/portfolio.ts
packages/contracts/src/portfolio.test.ts
```

It includes exact native Task target identity, Task/Wishlist statuses,
checklist records, assignment metadata, document/evidence links, monotonic
revision helpers, receipt separation, and legacy target resolution rules.

Still missing:

- persistence;
- owner-scoped server list/detail/write APIs;
- shared client runtime loading;
- real web/mobile lists and edits;
- native Task dispatch wired to exact target;
- Wishlist promotion after exact target selection; and
- one-time selected VoiceTools import.

Do the next Tasks work as one useful persistence/API/web/mobile vertical
slice. Do not insert another contract-only or preview-only gate.

### 9.4 Rotations

The read-only foundation is present:

- environment-aware rows;
- deterministic sort/group;
- native timestamps and telemetry freshness;
- current context and cumulative tokens when available;
- worker/role/standards metadata;
- bounded prompt preview;
- explicit disabled policy for rotate/successor/rename/archive/handoff/cutover;
  and
- separate ordinary native message control.

Still missing:

- calibrated warnings based primarily on current used/max context;
- one bounded native Rotate request with receipt;
- successor creation;
- durable handoff/cutover state;
- rename/archive reverse controls; and
- automated or assisted cutover.

Do not add another preview-only Rotations tranche. When prerequisite messaging,
Heartbeat, and Task paths are useful, the next meaningful Rotations slice is
one bounded reviewed request.

## 10. Context, session size, and storage health

This session reconciled three meanings of “size.” Keep them separate.

### 10.1 Context health

This is live provider telemetry for one thread:

```text
usedTokens
maxTokens
totalProcessedTokens
compactsAutomatically
updatedAt/freshness
```

Current source parses real used/max data in
`apps/web/src/lib/contextWindow.ts`. Rotations currently classifies against
cumulative processed-token constants in
`apps/web/src/portfolioContextHealth.ts`:

```text
watch:    150,000,000 processed tokens
required: 200,000,000 processed tokens
```

Those constants need calibration. Current used/max percentage should become
the primary warning; cumulative processed tokens are secondary evidence.
Context warnings do not automatically authorize rotation.

### 10.2 Session footprint

This is the on-disk size of Codex/Claude transcript/session files. T3's
existing `apps/server/src/usage/UsageService.ts` already scans provider
transcripts and caches per-file `(size, mtime)` metadata. Reuse or narrowly
extend that walk for per-session/project bytes. Do not add another deep
scanner or parse complete transcript contents merely to calculate bytes.

Session bytes may identify a review candidate. They do not authorize archive
or deletion.

### 10.3 Host storage health

This includes:

- T3 `state.sqlite`, WAL, and SHM;
- T3 logs and attachments;
- Codex `logs_2.sqlite`, other state, and sessions;
- declared caches;
- generated output and backups;
- Git objects/worktrees; and
- dependency/build output.

The 23 August Mac read-only evidence snapshot recorded approximately:

| Path/class            |    Size | Boundary                                  |
| --------------------- | ------: | ----------------------------------------- |
| T3 `state.sqlite`     | 7.25 GB | protected active state                    |
| T3 logs               |  728 MB | inspect owner/retention                   |
| T3 attachments        |  376 MB | retained user/thread data                 |
| Codex sessions        |  6.8 GB | retained transcripts                      |
| Codex `logs_2.sqlite` | 1.30 GB | protected active state                    |
| Codex declared cache  |   15 MB | candidate only through owner policy       |
| generated images      |   51 MB | user-visible output, not cache by default |
| `.codex_backup`       |  677 MB | intentional backup pending review         |

These are evidence, not deletion instructions. Re-measure before action.

### 10.4 Storage Health product slice

Build one authenticated, environment-scoped, on-demand read endpoint that
returns bounded metadata such as:

```text
path
class
owner
bytes
modifiedAt
fileCount
active/protected/candidate state
supported lifecycle action, if any
```

Then replace the honest `Not connected` Portfolio Storage placeholder with
selected-environment data on web/mobile where practical.

Do not build a continuous scanner, second session registry, VoiceTools storage
owner, or cleanup scheduler. Existing provider event NDJSON logs have their own
bounded retention; that policy does not imply general retention for every T3
or Codex file.

### 10.5 Maintenance/cleanup boundary

Any future active database reduction is a product-owned maintenance operation,
not an ad hoc shell command. It may act only on already eligible
deleted/expired records and requires:

1. sole writer quiesced;
2. required backup/rollback point;
3. bounded schema-owned transaction;
4. integrity validation;
5. product-approved checkpoint/compaction;
6. normal owner restart; and
7. before/after receipt.

Never directly delete T3/Codex databases, WAL/SHM, active logs, transcripts,
attachments, backups, unknown roots, credentials, or Git state. Heartbeats may
report storage health later; they must not run cleanup.

## 11. Chronology of the main problems and decisions

This chronology is included so the successor understands why the operating
model is strict without reopening every failed path.

### 11.1 Portfolio/Heartbeat direction

The work began by consolidating Portfolio plans and deciding that Heartbeats,
Tasks, Rotations, messaging, and later voice functions should become native T3
capabilities. VoiceTools would remain temporary source evidence rather than a
second T3 architecture.

The early source work created Heartbeat targets, context warnings, paused
drafts, owner semantics, workflows, Storage placeholder, and Rotations
foundations. Tasks later received a typed contract foundation.

### 11.2 Port and profile failures

The user attempted to run Dev on `3773` against `/Users/snedmusic/.t3` while a
packaged T3 backend already owned that port/profile. This produced
`EADDRINUSE`, restart loops, and invalid-credential behaviour.

A different port did not solve shared-state ownership. Conversely, pointing
Dev at a fresh home produced an empty project list, which was initially
misdiagnosed as missing data. The correct model is that home/profile selects
state; port selects address.

The current resolution is Alpha live profile on `3773`, isolated Dev profile
on `3774`, and native environment pairing when Dev needs Alpha's threads.

### 11.3 Source crashes on Mac

During active source development, malformed contract edits and missing symbols
caused build and Electron failures. Later, opening a generated image or a diff
triggered dynamic-import crashes. Rebuild/reload disrupted other agents.

The user explicitly prohibited unrequested T3 rebuilds/restarts after these
incidents. Source GUI work was moved to the VPS so Mac Alpha could remain the
coordination surface.

### 11.4 Multi-computer connectivity

Tailscale pairing initially timed out because remote T3 endpoints were not
reachable or Tailscale/client state was inconsistent. The Windows firewall,
Tailscale login/startup, T3 Network Access, pairing links, and environment
registration were worked through. Mac eventually connected to the Windows
laptop and successfully opened a project/thread and sent a normal native T3
message.

The VPS was also paired. Tailscale IP, Tailscale HTTPS, direct T3 pairing, SSH,
and T3 Connect were clarified as related but distinct options. OpenSSH over
Tailscale was standardized for machine administration.

### 11.5 VPS Codex provider failure

The VPS Codex provider showed timeout/unavailable after restart/update work.
The provider later returned to working state. The exact transient cause was
not conclusively proven in this handoff. Large Codex/T3 state and provider
maintenance became a separate storage-retention concern. Do not claim a
Codex reinstall or database cleanup is required without fresh evidence.

### 11.6 VoiceTools messaging instability

VoiceTools had been retargeted between T3 ports and used a backend around port
`8507`. Agents reported connection refused, stale/unknown `host_id`, dispatch
delays, and messages that were accepted without immediate target turn start.
Restarting or retargeting the bridge restored some sends but kept the system
fragile and difficult to reason about.

This reinforced the decision to stop using VoiceTools as the ordinary message
path rather than continually repairing it.

### 11.7 Native T3 messaging discovery

One agent initially claimed native dispatch was unavailable because it could
not see a dedicated tool. Another successfully used `functions.exec`, the T3
CLI auth command, `HttpApiClient`/HTTP orchestration snapshot, and
`client.orchestration.dispatch` with `thread.turn.start`.

Once the exact working method was supplied, the previously blocked agents
successfully exchanged a message and ACK. The real gap was instructions and
convenience, not backend capability.

Historical sideband code was then rediscovered. It was briefly over-promoted
as the next prerequisite. The documentation has been corrected: native sends
work now; sideband is optional reference/convenience only.

### 11.8 Session/storage consolidation

Large T3 and Codex state had become an ongoing operational concern. The final
decision separated context pressure, transcript bytes, and database/storage
growth. The existing Usage scanner should be reused, and any cleanup must be
an explicit owner-supported maintenance feature.

## 12. Updated build order

### Phase 1 — lock the operating topology

- Keep Mac Alpha on `3773` with `/Users/snedmusic/.t3`.
- Keep Mac Dev isolated on `3774` and pair it to Alpha before using it again.
- Give environment entries clear host plus Alpha/Dev labels.
- Record current environment IDs in the lifecycle runbook after a read-only
  current inventory.

### Phase 2 — converge messaging on proven native T3

- Put the exact working auth/snapshot/dispatch/readback procedure into the
  reusable agent standard.
- Capture one current Windows-laptop-to-Mac receipt and target reply.
- Capture one current VPS-to-Mac receipt and target reply.
- Use the same procedure for a local and remote send from the VPS source
  environment.
- Reconcile central and target `AGENTS.md` guidance.
- Do not make a helper command or sideband recovery a gate.

### Phase 3 — retire VoiceTools messaging

- Freeze recoverable source/data.
- Inventory retained voice and migration features.
- Deprecate/reject new VoiceTools message dispatch.
- Remove the bridge from normal messaging startup/health expectations.
- Preserve retained voice/read-only functionality until native replacements
  exist.

### Phase 4 — stabilize VPS source Dev

- Fix image preview.
- Fix diff preview and confirmed related Electron failure path.
- Validate native worker Stop control.
- Exercise one representative image and diff.
- Push focused source changes before Mac promotion.

### Phase 5 — native Context, Session, and Storage Health

- Make current used/max context the primary warning.
- Reuse Usage scan metadata for transcript bytes.
- Add one environment-scoped on-demand Storage Health endpoint.
- Add selected-environment Portfolio display.
- Keep cleanup/compaction a later explicit maintenance operation.

### Phase 6 — finish native Heartbeats

- Make VPS the direct initial owner.
- Complete canonical record persistence and owner-scoped readback.
- Import selected VoiceTools definitions once as paused records.
- Render web/mobile.
- Run one manual one-response native Heartbeat and persist receipt/readback.
- Add one VPS scheduler only after the manual path works.

### Phase 7 — finish Tasks and Wishlist

- Build one persistence/API/web/mobile Task vertical slice.
- Add edits, checklist, status, revision, and receipt separation.
- Dispatch a Task through native T3.
- Add Wishlist promotion after exact target selection.
- Import selected legacy records once.

### Phase 8 — finish Rotations

- Calibrate context warnings.
- Add one bounded native Rotate request.
- Then add successor, handoff, archive/rename, and cutover controls with visible
  reverse states.

### Phase 9 — port retained voice features and close migration

- Add a T3-owned TTS interface for desktop/mobile.
- Port required realtime assistant functions without restoring a message
  broker.
- Remove retired VoiceTools message code/startup dependencies.
- Preserve/archive the remaining repository/runtime only according to explicit
  retained-feature decisions.

## 13. Parallel worker allocation

The next useful work can proceed in three parallel VPS lanes while the Mac
coordinator remains on Alpha:

### Lane A — native messaging convergence

Primary objective: every current host can use the same proven native T3 send
procedure.

Deliverables:

- exact reusable instructions;
- current reverse receipts from laptop and VPS;
- central guidance reconciliation; and
- no VoiceTools fallback.

Optional later hardening: package the procedure as a first-class T3 command.

### Lane B — Dev stability

Primary objective: source Dev can open images and diffs and stop a worker
without crashing/restarting the user's Mac control surface.

Deliverables:

- focused image/diff fix;
- one representative VPS Dev use of each;
- Stop-control validation; and
- focused push to the shared branch.

### Lane C — Storage Health

Primary objective: Portfolio can show truthful selected-host context,
transcript, and storage evidence without mutating it.

Deliverables:

- environment-scoped read contract/endpoint;
- reuse of Usage file metadata;
- Portfolio Storage display; and
- protected/candidate classification.

Cleanup is not part of the first slice.

After these lanes, proceed to Heartbeat records, then Tasks, then Rotations.

## 14. AntiGate execution standard

For every proposed next action, ask:

1. What end-to-end capability does this move forward?
2. What is the smallest canonical implementation?
3. What single focused check covers the changed seam?
4. Is one bounded realistic operation now authorized and safe?
5. What exact mechanical failure would another proposed gate prevent?

Reject additional projections, registries, adapters, proof matrices,
capability frameworks, preview-only slices, or helper commands when the next
bounded canonical operation can expose the uncertainty.

Current examples:

- Native sends work; a sideband/helper command is optional.
- Tasks have contracts; the next work is a useful vertical slice, not another
  contract review.
- Rotations has previews; the next later work is a bounded native request, not
  another preview model.
- Storage needs read data first; cleanup design does not block the read
  endpoint/UI.
- Heartbeats need real records and one manual run before a scheduler; they do
  not need another broad architecture exercise.

## 15. Safety and operating boundaries

### 15.1 Hard boundaries

- Do not restart, rebuild, reload, quit, or replace Mac Alpha or Mac Dev
  without explicit user authorization for that exact runtime action.
- Do not start two T3 owners against the same T3 home.
- Do not use Mac source Dev against `/Users/snedmusic/.t3` while Alpha owns it.
- Do not kill processes by broad name/path pattern. Confirm exact owner and
  lifecycle before a stop.
- Do not directly mutate T3 or Codex SQLite.
- Do not delete WAL/SHM, sessions, attachments, logs, backups, credentials,
  worktrees, or unknown storage roots by inference.
- Do not duplicate an uncertain message. Read native receipt/target state
  first.
- Do not guess environment/project/thread identity.
- Do not silently fall back to VoiceTools for native messaging.
- Do not create a second scheduler, message broker, Portfolio ledger, or
  session registry.
- Do not package an installer for routine source iteration.

### 15.2 Normal allowed source work

Within an authorized implementation lane:

- inspect source/docs/Git read-only;
- edit source and focused docs;
- run focused tests/typechecks for changed seams;
- use VPS source Dev for realistic validation;
- push/pull the agreed source branch when that is the scoped coordination
  action; and
- report exact runtime actions separately before affecting Mac Alpha.

### 15.3 Transcript and runtime distinction

This handoff does not prove that:

- Alpha/Dev/VPS processes are currently running;
- all remote environments are currently online;
- VoiceTools is currently up or down;
- Codex provider health is currently good;
- every recorded Tailscale IP is unchanged; or
- the Windows clones remain at the Mac HEAD.

Recheck those facts through supported read-only surfaces when needed.

## 16. Immediate successor actions

The new `T3 Build Coordinator` should begin as follows:

1. Read this handoff, the authoritative consolidation plan, current `AGENTS.md`,
   and current Git status. Preserve the documentation tranche and confirm no
   new source edits overlap it.
2. The first paused VPS-owned Heartbeat is complete: command
   `c16b8ea1-e9d6-4e48-bf82-fc790ab03d21` reached Alpha sequence `899693`,
   received `HEARTBEAT_VPS_ALPHA_ACK`, and is stored by the VPS owner as
   `transcript-confirmed`. Keep the record paused; do not add a scheduler yet.
3. Use that VPS-to-Mac receipt and the remaining laptop reverse receipt to
   retire VoiceTools from ordinary messaging: inventory retained voice/data,
   reject new VoiceTools message dispatch, then update central and repository
   agent guidance as one coherent tranche.
4. Continue Tasks after the manual Heartbeat works. Dev stability and Storage
   Health remain independent VPS work; neither blocks this first operation.

## 17. Definition of near-term success

The next milestone is reached when:

- Mac Alpha remains stable and the phone remains usable;
- Mac, Windows laptop, and VPS can send native T3 turns in the required
  directions using one documented procedure;
- agents no longer need VoiceTools for ordinary messages;
- image and diff preview work in VPS Dev;
- native worker Stop works in VPS Dev;
- Portfolio can read truthful selected-host context/session/storage metadata;
  and
- VoiceTools messaging can be disabled without losing retained voice features.

The following milestone is a single VPS-owned native Heartbeat record that can
be viewed on desktop/mobile and manually run once with a truthful receipt.

## 18. Final handoff state

Primary objective: reliable native T3 coordination and Portfolio control across
Mac, Windows laptop, Windows VPS, and phone.

Completion value of the outgoing session:

- resolved Alpha/Dev profile and port architecture;
- established VPS-first source development direction;
- proved and documented native T3 agent messaging;
- identified and rejected unnecessary sideband dependency;
- consolidated VoiceTools retirement boundaries;
- incorporated Context/Session/Storage Health and cleanup standards;
- reconciled Heartbeat/Tasks/Rotations work order;
- updated the focused index, architecture, lifecycle runbook, and worker
  handoffs; and
- created this durable successor context.

Remaining genuine caveats:

- documentation changes are uncommitted;
- central Agents Dev Guidelines still contradict the native-only messaging
  decision;
- current reverse-direction fleet receipts remain to be collected;
- current environment labels/IDs need a fresh inventory;
- Mac Dev isolated pairing has not been freshly confirmed in this handoff;
- image/diff crashes and Stop control need VPS Dev validation;
- Storage Health has no real endpoint/UI yet;
- Heartbeats have authenticated VPS owner/record endpoints plus one fresh
  VPS-to-Alpha manual receipt; scheduler/UI follow only when needed;
- Tasks have contracts but not runtime integration;
- Rotations has no real rotation action; and
- retained VoiceTools voice capabilities are not yet ported.

Hard stop: only an actual wrong environment/profile, ambiguous native target,
second live owner, unavailable authoritative readback, protected-storage
mutation, or unapproved live runtime action should stop the next bounded work.
Optional hardening and richer proof are not prerequisites.
