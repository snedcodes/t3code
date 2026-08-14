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

## Cross-Host Build and Workspace Rule

- Before any build, package, deployment, cross-host source transfer, worktree
  creation, or worktree cleanup, invoke the matching centrally sourced
  portfolio skill. In particular, use `portfolio-build-release` before a T3
  build or build delegation, and `portfolio-git-hygiene` before cleanup.
- Build or delegate only after the product host profile and its source/disk/
  toolchain preflight pass. A clean checkout at the wrong commit is not build
  source. Do not develop in a runtime checkout.
- The initial T3 profile is maintained in
  `agents-dev-guidelines/DOCS/OPERATIONS/HOST_PROFILES/T3CODE_2026-08-14.md`.
  It supplements rather than overrides this repository's release instructions.

## Native T3 Coordination

- A visible T3 thread is the sole coordination identity. Address ordinary
  messages by its exact visible title and project; do not route from a guessed
  thread ID, legacy alias, window title, stale local note, or VoiceTools
  Passport. Unknown or duplicate titles are identity failures.
- Ordinary agent coordination must use the supported native T3 sideband
  dispatch command. It resolves the exact title on the owning host, dispatches
  through that host's local T3 orchestration API, and returns dispatch plus
  transcript evidence. For another host, SSH is transport only; it invokes the
  same supported command on the owning host. Do not write T3 SQLite directly.
- VoiceTools is optional phone alert/control infrastructure. Its backend must
  never be the sole dependency for agent-to-agent sending, coordination,
  readback, or handoffs. Its sender may be used only as an explicitly chosen
  phone/control compatibility path while native sideband dispatch is being
  introduced.
- For coordination, readiness, review, or cross-lane planning, read the recent
  relevant peer Main transcript through the native T3 readback surface. Read
  bounded associated Assistant history only when it materially affects a
  non-trivial decision. Neither transcript is approval, nor does either grant
  filesystem or runtime-control authority.
- When asked to create, spawn, brief, hand off to, or coordinate another
  project agent, create or reuse a real visible T3-backed session. Do not
  substitute a hidden Codex internal sub-agent unless the user explicitly asks
  for an internal Codex sub-agent. Before creating a session, check whether a
  suitable one already exists, define its project/path/role/lane, and verify
  native T3 readiness and capacity. Use the supported T3 creation surface.
  Unless the requester chooses otherwise, use `gpt-5.6-luna` with high
  reasoning and standard service mode. The requester can override model,
  reasoning, and service mode independently. Retain the creation receipt,
  Passport, requested/effective model settings, and VoiceTools
  discovery/phone-list visibility evidence.
- For this reliability fork, native coordination never authorizes direct
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
