# AGENTS.md

## Task Completion Requirements

- Keep local verification focused on the files and packages changed. Run the smallest relevant test set; do not run the full workspace test suite as a routine completion step.
  - Use `vp test run <test-files>` for focused built-in Vite+ tests. Use `vp run test` only when the affected package specifically requires its `test` script.
  - Backend changes must include and run focused tests for the changed behavior.
  - Run targeted formatting, lint, and type checks for the affected scope when available.
- Do not run repo-wide `vp check`, `vp run typecheck`, `vp run test`, or equivalent full-suite commands locally unless the user explicitly requests them. CI is responsible for the full verification suite.
- After frontend feature development or any user-visible frontend behavior change, the primary agent must run one integrated verification pass for each affected client surface after integrating the work:
  - Web: use the `test-t3-app` skill. Launch one isolated environment, authenticate through the printed pairing URL, and verify the affected flow in the controlled browser.
  - Mobile: use the `test-t3-mobile` skill. Connect one representative iOS Simulator or Android Emulator available on the host to one isolated environment and verify the affected flow. On compatible macOS hosts, prefer iOS for cross-platform changes and stream it through serve-sim in the T3 Code in-app browser or another available agent browser; use Android when it is the affected or viable platform.
  - Subagents must not independently launch dev servers or repeat integrated client verification unless their delegated task explicitly requires it.
  - Stop dev servers, watchers, and other long-running verification processes when the focused verification is complete.

## VoiceTools Passport Coordination

- A VoiceTools Passport is the sole active identity for a visible T3 session.
  Resolve the current Passport before sending or reading a peer session; do not
  route from a guessed thread ID, legacy alias, window title, or stale local
  note. Normalize a permitted alias to its current Passport before treating a
  mismatch as an error.
- For coordination, readiness, review, or cross-lane planning, read the recent
  relevant peer Main transcript through the current VoiceTools authoritative
  readback route before claiming current state. Read bounded associated
  Assistant history when it materially affects a non-trivial decision. Neither
  transcript is approval, nor does either grant filesystem or runtime-control
  authority.
- Use the canonical VoiceTools sender for important messages:
  `/Users/snedmusic/snedcodes/VoiceToolsSuite/voicetools/scripts/send_t3_message.py`.
  Use `--text-file` for non-trivial prompts. Record and interpret the receipt:
  transport acceptance is not transcript confirmation, and transcript
  confirmation is not task completion. If a send is ambiguous, inspect
  readback/audit evidence before retrying so a prompt is not duplicated.
- When asked to create, spawn, brief, hand off to, or coordinate another
  project agent, create or reuse a real visible T3-backed session. Do not
  substitute a hidden Codex internal sub-agent unless the user explicitly asks
  for an internal Codex sub-agent. Before creating a session, check whether a
  suitable one already exists, define its project/path/role/lane, and verify
  VoiceTools readiness and capacity. Use the VoiceTools-owned creation wrapper:
  `/Users/snedmusic/snedcodes/VoiceToolsSuite/voicetools/scripts/create_t3_agent_session.py`.
  Unless the requester chooses otherwise, use `gpt-5.6-luna` with low
  reasoning and standard service mode. The requester can override model,
  reasoning, and service mode independently. Retain the creation receipt,
  Passport, requested/effective model settings, and VoiceTools
  discovery/phone-list visibility evidence.
- For this reliability fork, Passport coordination never authorizes direct
  edits to T3 SQLite, control of the installed production app, termination of
  processes, reuse of production user-data, or automatic resend of pending
  prompts. Follow the local isolation and explicit-approval gates in the
  reliability plan before any such operation.
- Cross-agent messages use the first-line header `<Sender Session> -> <Target
  Session>`. Completion reports identify the Passport, relevant readback
  freshness, receipt outcome, changed files, validation, and any limitation.

## Package Roles

- `apps/server`: Node.js WebSocket server. Wraps Codex app-server (JSON-RPC over stdio), serves the React web app, and manages provider sessions.
- `apps/web`: React/Vite UI. Owns session UX, conversation/event rendering, and client-side state. Connects to the server via WebSocket.
- `packages/contracts`: Shared effect/Schema schemas and TypeScript contracts for provider events, WebSocket protocol, and model/session types. Keep this package schema-only — no runtime logic.
- `packages/shared`: Shared runtime utilities consumed by both server and client applications. Uses explicit subpath exports (e.g. `@t3tools/shared/git`) — no barrel index.
- `packages/client-runtime`: Shared runtime package for sharing client code across web and mobile.

## Reference Repos

- Open-source Codex repo: https://github.com/openai/codex

Use these as implementation references when designing protocol handling, UX flows, and operational safeguards.

## Vendored Repositories

This project vendors external repositories under `.repos/` as read-only reference material for coding
agents.

- Prefer examples and patterns from the vendored source code over generated guesses or web search results.
- Do not edit files under `.repos/` unless explicitly asked.
- Do not import from `.repos/`; application code must continue importing from normal package dependencies.
- Manage vendored subtrees with `vpr sync:repos`; use `vpr sync:repos --repo <id>` to sync one configured repository.
- When updating a dependency with a configured vendored subtree, sync that subtree in the same change so
  `.repos/` matches the installed dependency version.
- When writing Effect code, read `.repos/effect-smol/LLMS.md` first and inspect `.repos/effect-smol/` for
  examples of idiomatic usage, tests, module structure, and API design.
- When writing relay infrastructure code with Alchemy, inspect `.repos/alchemy-effect/` for examples of
  idiomatic usage, tests, module structure, and API design.
