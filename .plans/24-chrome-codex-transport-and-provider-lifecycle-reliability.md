# Plan 24: Chrome coexistence, Codex transport, and provider lifecycle reliability

Date: 3 August 2026  
Status: planning checkpoint; implementation and runtime rollout not started

## Outcome

Make T3 Code remain responsive while Google Chrome is open and in normal use.
Codex turns must not spend their working time in a five-attempt WebSocket
reconnect loop, and T3 must not leave unowned Codex provider processes or local
connections behind after their documented lifetime ends.

This plan is executable in order. Each phase has an evidence gate that must pass
before the next phase starts.

## Fast-path execution rules

This is a reliability repair, not a general T3 quality program. The following
rules apply to every phase:

- Run only the focused test or proof named in that phase. Do not run the full
  workspace test suite, broad compatibility archaeology, or unrelated cleanup.
- Time-box diagnosis and isolated validation. If the named proof passes, move
  forward; do not keep searching for hypothetical failures.
- A phase may have at most one focused implementation test run, one formatting
  check, and one bounded runtime proof unless a concrete failure requires a
  rerun after correction.
- Treat existing unrelated failures as recorded blockers, not invitations to
  repair adjacent systems.
- Do not add a new feature, dependency, migration, or test matrix dimension
  unless it is required by a concrete failure in the current proof.
- If Chrome-specific causation cannot be reproduced in one bounded comparison,
  record it as unproven and proceed with the independently confirmed HTTPS
  transport repair. Do not hold the transport fix hostage to proving Chrome's
  internal behavior.
- If the provider lifecycle audit finds no reproducible ownership defect, mark
  that work complete with evidence and make no lifecycle code change.
- Stop after the first successful isolated end-to-end proof. Additional soak,
  stress, fuzz, cross-platform, or long-duration testing belongs to a later
  separately approved plan.

The completion target is a working, reversible repair with focused evidence—not
exhaustive certainty about every network condition on the machine.

## Confirmed baseline

The 3 August read-only inspection established the following:

- The visible `Reconnecting... 5/5` entry is a Codex provider warning carried
  into the T3 work log. It is not T3's desktop-to-server reconnect banner.
- The provider reported
  `stream disconnected before completion: websocket closed by server before response.completed`.
- After five retries, Codex reported
  `Falling back from WebSockets to HTTPS transport`, and the turn resumed over
  HTTPS/SSE.
- T3's server listener on `127.0.0.1:3773` and the desktop's established local
  connection were healthy at the time of inspection.
- No authentication, rate-limit, system HTTP proxy, or local-port failure was
  present in the captured incident.
- Two Codex app-server process pairs were observed: one serving the current
  turn and one older pair with no active network connection at the instant of
  inspection. One desktop `CLOSE_WAIT` socket was also observed. The inspection
  did not establish whether either was outside its designed lifetime.
- Chrome had already been closed before process inspection. Therefore Chrome's
  exact triggering mechanism is not yet proven. Resource or network contention
  is a working hypothesis, not a completed diagnosis.

The transport defect is confirmed. A provider-process leak is not confirmed.
The process and socket observations justify a bounded lifecycle audit only;
they do not justify cleanup behavior. The transport defect and lifecycle audit
must be proved independently. A process is not considered leaked until its
expected owner, reuse policy, and shutdown deadline are established and the
process remains alive beyond that deadline.

## Safety and ownership boundaries

- Do not modify, migrate, compact, or test against the live legacy or
  operational SQLite databases.
- Do not alter `~/.codex/auth.json`, create another Codex login, or copy Codex
  credentials. Tests use the existing account through the normal Codex path.
- Do not terminate processes by executable name. Any lifecycle test may stop
  only a child PID created and recorded by the isolated test runtime.
- Do not patch an installed `app.asar` or replace the installed application.
- Do not interrupt active production turns or close Chrome as part of the
  acceptance proof.
- Do not install a repaired desktop build until the source proof passes and the
  user explicitly approves installation and a controlled T3 restart.
- Preserve all unrelated worktree changes.

## Scope

### Included

- Codex transport selection for T3-managed app-server children.
- A user-visible `Automatic` versus `HTTPS compatibility` transport setting.
- Provider PID, owner, state, transport, and shutdown diagnostics.
- Bounded provider shutdown and child reaping for T3-owned processes.
- User-controlled message timeline scrolling during incoming activity.
- Focused tests and a disposable Chrome-coexistence desktop proof.
- Packaging, controlled rollout, monitoring, and rollback instructions.

### Excluded

- Changes to Chrome, browser extensions, macOS network settings, VPNs, routers,
  DNS, or the user's general Codex configuration.
- Database migrations or conversation-history changes.
- A general provider-manager rewrite or broad dependency upgrade.
- Automatic killing of unknown, externally owned, or production processes.
- Claims that Chrome is the root cause without a capture made while Chrome is
  open and the failure is occurring.

## Target behavior

1. `HTTPS compatibility` makes new T3 Codex runtimes use HTTPS/SSE immediately
   with the existing ChatGPT/Codex authentication.
2. Chrome may remain open before, during, and after a T3 turn.
3. A failed upstream stream produces a bounded, actionable warning rather than
   an unexplained multi-minute stall.
4. Every T3-spawned provider process has a recorded T3 server PID, child PID,
   provider instance, owning thread/runtime, state, start time, and shutdown
   reason.
5. Active providers are never reaped. Providers that are intentionally cached
   or reusable are reported as such. Unowned providers are closed after a
   bounded grace period and verified gone by exact PID.
6. Closing the isolated T3 runtime releases its listener and all children it
   created.
7. While the user is reading older messages, incoming activity never moves the
   user's viewport. Auto-follow resumes only after the user returns to the
   live edge or explicitly selects `Scroll to end`.

## Sequential implementation plan

### Phase 0: Freeze the evidence and define the test matrix

- [ ] Record the installed T3 version, Codex version, macOS version, T3 server
      port, and relevant provider-log timestamps in a compact fixture/receipt.
- [ ] Capture one bounded failing or healthy comparison while Chrome remains
      open. Record Chrome CPU/memory and connection counts, T3 client
      connections, provider children, and provider warnings. Do not inspect
      Chrome content or browsing history.
- [ ] Define four isolated cases:
      1. automatic transport with Chrome closed;
      2. automatic transport with Chrome open;
      3. HTTPS compatibility with Chrome closed;
      4. HTTPS compatibility with Chrome open.
- [ ] Define an "owned provider" and the legitimate idle/reuse lifetime from
      the current `CodexSessionRuntime` and adapter shutdown paths. Conclude
      explicitly whether the previously observed older process was expected,
      indeterminate, or reproducibly leaked.

Gate 0: the receipt distinguishes confirmed defects, observations, and
hypotheses and contains no production mutation. If the Chrome-open failure
cannot be reproduced, the known provider log remains the transport regression
fixture, and no stronger Chrome-causation or provider-leak claim is made.

Fast-path limit: one Chrome-open comparison and one Chrome-closed comparison.
If the transport boundary is already reproduced from the existing provider
receipt, Phase 0 ends without further live incident hunting.

### Phase 1: Add a typed HTTPS compatibility transport

- [ ] Add a schema-backed Codex transport setting with two values:
      `automatic` and `https_compatibility`. Keep `automatic` as the upstream
      default for unaffected installations.
- [ ] Resolve the setting in the server before spawning `codex app-server`.
- [ ] For `https_compatibility`, select a T3-scoped HTTP-only OpenAI provider
      using the Responses API, the ChatGPT Codex HTTPS endpoint, existing
      OpenAI authentication, and `supports_websockets=false`.
- [ ] Keep this override T3-scoped. Do not write a replacement global Codex
      configuration and do not modify `auth.json`.
- [ ] Define launch-argument precedence deterministically so user-supplied
      arguments cannot accidentally re-enable WebSockets without an explicit
      diagnostic warning.
- [ ] Preserve model selection, reasoning effort, service tier, tools, MCP
      configuration, and standalone web search where supported by the current
      provider contract.
- [ ] Expose the selected transport in provider diagnostics and provider logs.
- [ ] Apply a changed setting only to newly created provider runtimes. Report
      that an existing runtime needs a safe restart; do not silently terminate
      it.

Likely files:

- `packages/contracts/src/settings.ts`
- `packages/contracts/src/settings.test.ts`
- `apps/server/src/provider/Layers/codexLaunchArgs.ts`
- `apps/server/src/provider/Layers/codexLaunchArgs.test.ts`
- `apps/server/src/provider/Layers/CodexSessionRuntime.ts`
- the existing provider-settings UI generated from the contracts schema

Focused tests:

- setting decoding/default and round-trip;
- exact generated app-server arguments for each mode;
- HTTPS mode cannot emit a WebSocket-capable provider configuration;
- existing launch arguments and auth/home paths remain intact;
- no secrets appear in logs or diagnostics.

Gate 1: focused tests pass and an isolated Codex app-server starts in HTTPS
mode, reports the intended provider, and can complete one harmless disposable
turn without a WebSocket attempt.

Fast-path limit: one focused settings/argument test run and one disposable
HTTPS turn. No model-by-model or tool-by-tool matrix at this phase.

### Phase 2: Audit provider ownership, then repair only a proved defect

- [ ] Map the current lifecycle from adapter session start through thread stop,
      provider replacement, server shutdown, and failed startup.
- [ ] Reproduce the expected start/idle/reuse/stop sequence with instrumented
      fixture children. If every child remains correctly owned and closes by
      contract, record that result and make no cleanup change.
- [ ] Add a runtime ownership record containing exact parent/child PIDs,
      provider instance, T3 thread, lifecycle state, and timestamps.
- [ ] Distinguish `active`, `intentionally_idle`, `closing`, `closed`, and
      `ownership_unknown`; do not label a reusable or not-yet-classified idle
      runtime as leaked.
- [ ] Only if the audit reproduces a child surviving beyond its documented
      owner and shutdown deadline, repair that path with bounded shutdown:
      request graceful closure, close the stdio/RPC scope, wait for the
      configured grace period, then reap only the exact recorded child/process
      group created by that runtime.
- [ ] Ensure cancellation, startup failure, and server shutdown execute the
      same ownership release path exactly once.
- [ ] Remove stale local subscriptions/sockets when their owning client scope
      closes.
- [ ] Emit a compact shutdown receipt with owner, child PID, reason, elapsed
      time, and final result.
- [ ] Do not add a process-name scanner or automatic termination of unknown
      Codex processes.

Likely files:

- `apps/server/src/provider/Layers/CodexSessionRuntime.ts`
- `apps/server/src/provider/Layers/CodexAdapter.ts`
- existing provider-runtime diagnostics/shutdown modules and their tests

Focused tests:

- an active provider is retained;
- a documented reusable idle provider is retained and identified;
- stopping its owner closes exactly the recorded child;
- cancellation and failed startup leave no test child;
- repeated shutdown is idempotent;
- one thread cannot reap another thread's provider;
- server shutdown leaves no listener or provider child created by the fixture.

Gate 2: the fake-child lifecycle tests pass, and an isolated two-session proof
shows that the active session survives while only the deliberately closed
session's exact provider child exits.

Fast-path limit: one fake-child lifecycle test run and one two-session proof.
If no lifecycle defect reproduces, skip implementation changes and record the
audit result.

### Phase 3: Make user timeline position authoritative

Current relevant implementation is split between
`apps/web/src/components/ChatView.tsx` and
`apps/web/src/components/chat/MessagesTimeline.tsx`:

- `ChatView` tracks `following-end`, `anchoring-new-turn`, and
  `free-scrolling` modes and calls `scrollToEnd` while following the live edge.
- `MessagesTimeline` reports `isNearEnd`/`isAtEnd` and currently enables
  LegendList `maintainScrollAtEnd` for data, item-layout, and layout changes
  when no anchored end space is active.
- Native wheel, touch, and pointer listeners currently cancel live-follow, but
  the list's built-in end maintenance can still compete with that state during
  incoming data or row-size changes.

Implement the smallest ownership correction:

- [ ] Keep one authoritative follow state: `following-end` or
      `free-scrolling`. A user scroll gesture, scrollbar drag, keyboard scroll,
      touch scroll, or minimap navigation enters `free-scrolling` immediately.
- [ ] Enable LegendList end maintenance only while the authoritative state is
      `following-end`. While `free-scrolling`, incoming data, streaming row
      growth, item layout changes, and composer-size changes must not call
      `scrollToEnd` or otherwise reposition the viewport.
- [ ] Preserve the current scroll offset/visible row anchor while older rows
      change size. Do not use browser CSS scroll anchoring and LegendList end
      maintenance at the same time for the same update.
- [ ] Treat `isNearEnd` as a re-arm signal only when it follows an actual user
      return to the bottom. Programmatic layout movement must not re-enable
      live-follow merely because the list reports near-end during a render.
- [ ] Keep the existing `Scroll to end` affordance. Clicking it is explicit
      user navigation: jump to the latest content, mark `following-end`, and
      allow subsequent streaming activity to follow again.
- [ ] If the user was already `free-scrolling` when they send a message,
      preserve their current viewport. Do not treat sending alone as permission
      to yank the view to the latest turn. The new activity remains available
      through the existing scroll-to-end affordance.
- [ ] Preserve initial thread-open behavior: a newly opened thread may start at
      the end, but once the user scrolls away, incoming activity cannot reset
      the position.
- [ ] Keep explicit minimap selection and other intentional navigation working;
      those actions may update the mode according to whether they land at the
      live edge.

Focused tests:

- [ ] Add pure transition coverage for live-edge follow, user-scroll opt-out,
      programmatic data/layout changes, return-to-end re-arm, explicit
      `Scroll to end`, and thread-open initialization.
- [ ] Add a focused `MessagesTimeline` regression assertion that free-scrolling
      disables end-maintenance behavior while following-end retains it.
- [ ] Run one integrated web proof in the isolated T3 environment: start a
      disposable turn, scroll at least several messages upward, allow incoming
      activity for one bounded interval, and verify the visible position stays
      fixed; then click `Scroll to end` and verify follow resumes.

Acceptance criteria:

- At the bottom, incoming assistant text/tool activity continues to follow the
  newest content.
- After the user scrolls upward, the same incoming activity leaves the visible
  older messages in place.
- The viewport does not jump because of streaming text, tool rows, row
  expansion, composer resizing, or new message data.
- Returning to the bottom or pressing `Scroll to end` intentionally restores
  follow behavior.
- Switching threads still initializes at the newest content.
- No message/event persistence or provider lifecycle behavior changes.

Fast-path limit: one focused transition/render test run and one isolated
integrated web proof. No scroll-performance benchmark, browser matrix, or
long-duration UI soak test is required.

Gate 3: the user can scroll upward during an incoming disposable turn and the
visible viewport remains fixed; returning to the bottom or pressing `Scroll to
end` re-enables follow behavior. No production UI or database state is touched.

### Phase 4: Improve visible recovery behavior

- [ ] Replace the ambiguous work-log-only presentation with a concise transport
      diagnostic: current transport, retry count, and whether HTTPS fallback is
      active.
- [ ] Keep the turn interrupt action available while transport recovery is in
      progress.
- [ ] Ensure a transport warning does not mark a completed turn as still
      working and that a terminal failure settles predictably.
- [ ] Do not automatically resend a prompt. Resume only through the provider's
      supported continuation semantics or explicit user action.

Gate 4: focused provider-ingestion tests prove warning, fallback, interrupt,
terminal failure, and completion projections. If UI text or controls change,
run the required isolated web verification with the `test-t3-app` skill.

Fast-path limit: one focused ingestion test run. If no UI code changes, do not
run client integration verification for this phase.

### Phase 5: Prove Chrome and T3 coexist in a disposable desktop environment

- [ ] Create a fresh disposable T3 home, userData directory, database, app
      identity, workspace, and non-production ports.
- [ ] Run the existing isolation preflight and record every resolved path and
      listener before launch.
- [ ] Keep the user's normal Chrome application open. Do not close it during
      the test and do not require changes to its extensions or settings.
- [ ] Launch only the isolated desktop build with HTTPS compatibility enabled.
- [ ] Complete a bounded sequence across two disposable threads, including one
      normal turn, one interrupted turn, and one resumed/new turn.
- [ ] Confirm provider logs contain HTTPS/SSE operation and no
      `Reconnecting... 1/5` through `5/5` WebSocket sequence.
- [ ] Confirm T3 remains connected locally, both threads remain readable, and
      Chrome remains usable.
- [ ] Close the isolated desktop normally and verify by exact PID and port that
      its desktop, server listener, and provider children are gone.
- [ ] Compare memory, file-descriptor, socket, and child counts with the Phase 0
      baseline. Record results rather than relying on visual impressions.

Gate 5: Chrome remains open throughout; all bounded turns complete or settle;
there are zero WebSocket retry sequences in HTTPS mode; and clean exit leaves
no owner, listener, or child created by the disposable runtime.

Fast-path limit: one disposable desktop launch, one normal turn, one
interrupt-or-recovery turn, and one clean shutdown. Do not run a soak test.

### Phase 6: Build, install, and cut over only after approval

- [ ] Produce a signed or locally ad-hoc-signed T3 desktop build according to
      the existing operational launcher/package contract. Do not patch an
      installed bundle in place.
- [ ] Record source commit, Codex version, app identity, database/home target,
      transport default, and build checksum.
- [ ] Present the isolated proof receipt and request explicit approval for the
      installation and controlled restart.
- [ ] At an approved quiet point, verify no active production turn, close the
      old T3 normally, install/update the intended app non-destructively, and
      launch it once with Chrome still open.
- [ ] Verify the expected profile/database before allowing a message send.
- [ ] Complete one harmless user-approved production turn and inspect only its
      transport/lifecycle receipt.
- [ ] Monitor provider reconnect warnings, owned child count, stale socket
      count, listener ownership, and clean quit behavior during the initial
      observation window.

Gate 6: the approved daily app completes normal work while Chrome is open and
does not reproduce the five-retry stall. No database, login, session-history,
or unrelated application change is part of the cutover.

Fast-path limit: one controlled user-approved turn after installation, followed
by the initial observation receipt. Broader monitoring is optional follow-up,
not a prerequisite for declaring the repair operational.

### Phase 7: Rollback and follow-up

- [ ] Preserve the prior application/build and its launch instructions until
      the observation gate passes.
- [ ] If HTTPS mode causes an auth, model, tool, or MCP regression, stop new
      sends, close T3 normally, return to the prior build or `automatic`
      transport, and retain the failure receipt. Do not alter conversation
      history.
- [ ] If HTTPS mode works but Chrome still correlates with stalls, capture the
      new exact boundary. Investigate macOS network extensions, IPv4/IPv6
      selection, memory pressure, and Chrome connection load separately; do not
      weaken the completed provider-lifecycle safeguards.
- [ ] Replace the compatibility provider with an upstream first-class HTTPS
      switch when Codex exposes and proves one. Keep the user-facing setting so
      affected environments retain a supported fallback.

## Completion criteria

This plan is complete only when all of the following are true:

- Chrome remains open and usable throughout the isolated and approved daily
  T3 proofs.
- HTTPS compatibility completes Codex turns without any WebSocket retry loop.
- Existing Codex authentication, model access, tools, MCPs, and session history
  remain available.
- Provider ownership diagnostics explain every T3-created child process.
- Normal close releases the T3 listener and all provider children owned by that
  runtime.
- No active provider is terminated and no unknown process is targeted.
- Focused backend tests, targeted formatting/type checks, and required
  integrated verification pass.
- Build, install, rollout, and rollback receipts identify exact versions,
  paths, PIDs, ports, and results.

## Current checkpoint and next action

Only the read-only incident inspection and this planning document are complete.
No source implementation, configuration change, runtime restart, build install,
or production proof has occurred.

The next action is Phase 0: create the evidence fixture and test matrix, then
implement Phase 1's typed HTTPS compatibility setting on the reliability fork.
