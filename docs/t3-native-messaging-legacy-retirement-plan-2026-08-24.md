# Native T3 Messaging Legacy Retirement

Date: 24 August 2026

## Decision

Ordinary agent coordination uses only native T3. There is one path:

```text
$message
-> supported short-lived T3 session
-> live orchestration snapshot
-> exact environmentId + projectId + existing threadId
-> POST /api/orchestration/dispatch (thread.turn.start)
-> native receipt and target-thread readback
```

The supported `t3 auth session issue` command is permitted control-plane
authentication. It is not direct SQLite or state-file access. A missing legacy
`/api/auth/local-session` route is irrelevant to this path.

No bridge, helper, relay, title-only route, Passport/host identity, or legacy
message API remains an ordinary coordination option. `$message` is the reusable
operator procedure for an existing thread. Visible-worker creation stays a
separate explicit `thread.create` then `thread.turn.start` action.

## Triggering evidence

The native T3 thread `Streamline Trading Execution Iterations`
(`72cbe012-29c2-4c97-98f6-03d3c217c4e3`) recorded the failure clearly:

- a VolGrid instruction required
  `VoiceToolsSuite/voicetools/scripts/send_t3_message.py`;
- that script resolves Passport/host/session aliases and calls VoiceTools
  `/api/codex` routes on port 8507;
- a Passport-to-source conflict wedged that backend and blocked coordination;
- a subsequent attempt used the optional T3 sideband CLI, whose obsolete
  local-session assumption failed; and
- the direct replacement succeeded: command
  `8e32d35e-fb91-41ae-90d8-215721ec32c7`, sequence `900295`, reached
  `Prepared Actions Coordinator 24 Aug` and returned `T3_NATIVE_OK`.

T3 itself exposes the required native surfaces in
`packages/contracts/src/environmentHttp.ts` and
`apps/server/src/orchestration/http.ts`: authenticated snapshot, exact thread
snapshot, and `thread.turn.start` dispatch.

## Cutover

1. **Remove coordination behavior, not replace it.** Delete
   `voicetools/scripts/send_t3_message.py` and every active caller, launcher,
   self-test, bridge, Passport/session-registry route, and polling loop whose
   purpose is agent messaging, thread discovery, transcript readback, worker
   creation, or coordination status. Do not provide a compatibility shim.

2. **Remove T3 sideband.** Delete the public `sideband-send` and
   `sideband-send-ssh` CLI commands, their implementation/tests, CLI exports,
   and active documentation. Preserve native orchestration APIs; they are the
   replacement, not a new layer.

3. **Make VoiceTools non-coordination or stop it.** Remove its agent-message
   backend surfaces and service dependencies. Inventory any retained feature
   that still requires the backend (TTS, realtime voice, or phone alerts). If
   none remains after this deletion, stop and disable the backend on every
   owner host. If one remains, it must not expose or depend on agent messaging,
   T3 session discovery, transcript readback, Passport routing, or port-8507
   coordination endpoints.

4. **Replace active instructions in one sweep.** The Agents Dev Guidelines
   coordinator owns central guidance. It should make `$message` the only
   ordinary-send instruction and delete active references to legacy routes,
   scripts, port 8507, Passport/host identity, and sideband. Each affected
   repository then receives the same short native-T3 section. Do not retain a
   long list of forbidden fallback examples after the sweep: the canonical
   `$message` instruction is sufficient.

5. **Remove historical operational debris deliberately.** Search all owned
   repositories, generated indexes, handoffs, runbooks, and scripts for the
   retired names and routes. Delete obsolete operational documents and generated
   copies; retain only a single dated retirement record outside active guidance
   if provenance is needed. No active search result may suggest an alternate
   messaging path.

## Source-first inventory

Initial confirmed executable surfaces:

| Scope                 | Active retirement target                                                                                                                                                                                             |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| VoiceTools            | `voicetools/scripts/send_t3_message.py`; VoiceTools `/api/codex` coordination/bridge/session/Passport routes; watchdog, restart, daemon, and phone validation scripts that treat those routes as agent coordination  |
| T3 Code               | `apps/server/src/cli/sideband.ts`, `sidebandSsh.ts`, their tests, and exports from `src/bin.ts`                                                                                                                      |
| VolGrid               | legacy VoiceTools coordination documents and generated documentation indexes; current `AGENTS.md` already uses `$message` and is not to be independently rewritten while the guideline-coordinator tranche is active |
| Agents Dev Guidelines | active references to sideband as optional and historical VoiceTools coordination material still linked from `CURRENT.md`; the coordinator owns this sweep                                                            |

This is an inventory starting point, not permission to bulk-delete unreviewed
files. Resolve each live caller before deletion; do not preserve an active
fallback merely because it is easier than moving the caller to `$message`.

## Completion conditions

- native dispatch works with `$message` on each required host;
- no public sideband command is shipped by T3 Code;
- no VoiceTools endpoint, process, script, or configuration can send, route,
  discover, read back, or create an agent session;
- no active repository instruction or generated index advertises a retired
  messaging path; and
- VoiceTools backend service is disabled unless an explicitly retained
  non-coordination feature still needs it.

## AntiGate review

**Primary objective:** every agent sends one reliable native T3 turn without
depending on another product.

**Completion value:** remove the two alternate transports and their discovery
systems; retain the existing native T3 endpoint.

**Gate audit:** a source/caller sweep is required before stopping the backend
because it prevents a hidden live dependency from silently losing service.
One focused deletion test per changed surface and one normal `$message` send on
each required host is sufficient. A test message before every future send,
another transport, or a replacement scheduler is not required.

**Next action:** assign the VoiceTools source deletion and T3 sideband deletion
as separate bounded source changes, then let the Guidelines coordinator replace
active instructions before the service shutdown.
