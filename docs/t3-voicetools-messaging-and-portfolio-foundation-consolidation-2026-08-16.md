# T3/VoiceTools Messaging and Portfolio Foundation Consolidation

Date: 16 August 2026 (Melbourne)

Status: source-traced execution brief; no runtime or VoiceTools files changed

## Purpose

This document gathers the current messaging and Portfolio decisions into one
working plan. It is the source for the next implementation slices. It does not
start Heartbeats, add a scheduler, add polling, create a second session
registry, integrate the Realtime Assistant, or replace the VoiceTools system.

## The target architecture

Native T3 owns projects, threads, provider turns, interruption, and execution.
VoiceTools is a thin adapter around that authority:

```text
human title or known target
  -> resolve one exact T3 identity when needed
  -> direct VoiceTools command
  -> native T3 thread.turn.start
  -> compact receipt
  -> optional downstream transcript readback
```

The human address is an exact visible T3 title. The internal address is the
canonical Passport/owner route and T3 thread ID. Passport is an identity and
authorization coordinate, not a human-facing ceremony and not a second
execution system.

## Current VoiceTools send call graph

### Title-based discovery

`scripts/send_t3_message.py::resolve_target` calls
`_resolve_target_by_title`, which reads `/api/codex/sessions` with a bounded
inventory query, matches the exact title (and optional project/host), and
builds a host-qualified route with `_canonical_route_from_inventory_item`.

This inventory read is legitimate target discovery. It must not be repeated as
a send gate after one exact target has been resolved.

### Exact canonical target

For `host:t3-thread:<uuid>`,
`send_t3_message.py::_optimistic_t3_target` accepts the address without a
status, message, or inventory preflight. This is the desired fast path.

The API then follows:

```text
POST /api/codex/commands/send
  server::_enqueue_codex_command_internal
  server::_resolve_codex_command_target
  Passport/owner identity check
  codex_command_service.enqueue_command
  T3DispatchCodexCommandRouter.send_to_session
  T3BridgeClient.dispatch_turn_for_session
  T3BridgeClient.dispatch_turn
  POST /api/orchestration/dispatch
  native T3 thread.turn.start
```

The native dispatch payload is built in
`voicetools/api/t3_bridge.py::T3BridgeClient.dispatch_turn`:

```json
{
  "type": "thread.turn.start",
  "commandId": "<new command id>",
  "threadId": "<canonical T3 thread id>",
  "message": {
    "messageId": "<new message id>",
    "role": "user",
    "text": "<prompt>",
    "attachments": []
  },
  "runtimeMode": "full-access",
  "interactionMode": "default",
  "createdAt": "<UTC timestamp>"
}
```

The command service records the command and the API returns an accepted
receipt. Transcript confirmation is started after acceptance by
`server::send_codex_command`; it must never be a pre-send veto.

### Compatibility paths that still do extra work

The following are remaining complexity points to remove or tightly limit:

1. A non-canonical session key first tries
   `send_t3_message.py::_resolve_target_by_status`, which reads the selected
   status and optionally one message, then falls back to the full sessions
   endpoint. This is compatibility behaviour, not needed for a canonical
   Passport/T3 route.
2. `server::_resolve_codex_command_target` resolves a Passport and validates
   supplied aliases. For a local non-explicit-Passport identity it may call
   `_canonicalize_local_t3_target_session_id` and `_session_exists_fast`.
   Those are identity checks for legacy inputs, not needed after exact T3
   Passport resolution.
3. For a non-exact peer identity, the server may use cached peer inventory,
   `_probe_peer_session_by_status`, and finally `_refresh_single_peer_host`.
   An exact Passport/T3 thread is already allowed through while broad peer
   inventory is stale; new callers should use that path.
4. `T3BridgeClient.dispatch_turn` waits after dispatch for the specific
   projected user message and then reads selected thread state. This is
   downstream evidence. A dispatch timeout plus missing confirmation still
   needs clearer `uncertain` handling so it cannot cause a blind resend.
5. The command monitor and receipt layers retain historical UI/route metadata.
   Those fields are useful diagnostics, but they must not decide whether an
   exact T3 direct send is permitted.

The normal path must not require full inventory, peer health, unrelated
readiness, another session's state, phone/TTS state, planning state, or a
pre-send transcript read.

## Exact native T3 Stop path

The current visible red Stop action is not a fake transcript event and is not
a process kill. The source path is:

```text
web ChatView::onInterrupt
  -> threadEnvironment.interruptTurn
  -> client-runtime::interruptThreadTurn
  -> command type thread.turn.interrupt
  -> authenticated POST /api/orchestration/dispatch
  -> orchestration decider
  -> thread.turn-interrupt-requested event
  -> ProviderCommandReactor::processTurnInterruptRequested
  -> ProviderService::interruptTurn
  -> provider adapter::interruptTurn
  -> CodexSessionRuntime::interruptTurn
  -> Codex app-server request turn/interrupt
```

The command contract is defined in
`packages/contracts/src/orchestration.ts::ThreadTurnInterruptCommand`:

```text
threadId: required canonical T3 thread ID
turnId: optional orchestration turn ID
```

The web helper
`apps/web/src/components/ChatView.logic.ts::buildThreadTurnInterruptInput`
uses the thread ID and includes the session's active turn ID only when the
session is projected as running.

The provider-level Codex request is defined in
`apps/server/src/provider/Layers/CodexSessionRuntime.ts::interruptTurn` and is
`turn/interrupt` with the provider thread ID and effective active provider
turn ID. The orchestration reactor currently calls the provider by thread and
lets the provider runtime select its active turn; this is the exact detail to
preserve or make explicit before adding a VoiceTools interrupt wrapper.

VoiceTools now has a narrow adapter in commits `d76823cc` and `e06e4cfd`:
`POST /api/codex/commands/interrupt`. It resolves the selected T3 Passport,
checks the expected active turn, requests the authenticated native T3 command
on the owning backend, and returns the native dispatch receipt. Peer forwarding
passes only the exact thread and turn identity to the owner; it does not use a
local inventory refresh as a gate. The adapter does not edit T3 SQLite,
manufacture provider events, kill a PID, or resend automatically.

## Session registration lifecycle

VoiceTools currently has a backend-owned JSON registry at
`~/.voicetools/session_registry.v1.json`, implemented by
`voicetools/api/session_registry.py::SessionRegistryStore`.

The observed lifecycle is:

1. `T3SessionRegistryWatcher` optionally reads the local T3 projection
   database read-only at a bounded interval. It reads active thread metadata,
   latest turn/message identity, and project information; it does not load
   transcripts or provider runtimes.
2. `server::_collect_observed_session_items` combines authoritative local T3
   items with other local observations and optional cached peer items.
3. `SessionRegistryStore::synchronize` groups observations by
   `host_id + registry_id`. A T3 thread uses `t3-thread:<thread UUID>` as its
   registry identity. Duplicate observations are folded into one stable row.
4. The row retains the canonical/stable key, action session ID, observed
   aliases, T3 thread ID, title, project, role, ignored/main flags, and title
   drift information.
5. Unobserved rows are normally omitted from the next active projection, but
   rows marked main, ignored, or with a stored alias are retained. There is no
   complete explicit active/stale/retired lifecycle field yet.
6. `_register_exact_t3_phone_inventory_key` can register an already-resolved
   exact T3 key idempotently. If the watcher has not seen it yet, it writes a
   minimal `registration_pending` identity for later enrichment; it does not
   create a T3 session.

This registry is for discovery, aliases, and identity annotations. It must not
become a competing T3 session store or a mandatory pre-send database for an
already-resolved Passport.

## Portfolio and Heartbeat foundation

Portfolio/Heartbeat state needs one explicit owner. Until that owner seam is
implemented and checked, Heartbeats remain disabled.

The intended order is:

1. owner descriptor and owner epoch;
2. owner/non-owner/owner-unavailable responses;
3. one authoritative Task/Wishlist/Heartbeat ledger;
4. task-to-Passport and task-to-Heartbeat bindings with receipts;
5. only then, a controlled Heartbeat proof.

Heartbeat delivery must reuse the direct Passport sender. A delivery failure
records `delivery_failed`; it must not automatically block, pause, complete,
disable, or replace the target.

## Consolidated implementation order

### Slice 1 — direct messaging gate removal

Audit and narrow the remaining compatibility paths. Preserve title discovery,
but make exact Passport/T3 callers bypass status, message, inventory, peer
refresh, and unrelated readiness checks. Add focused tests for the call graph
and receipt states.

### Slice 2 — direct readback truth

Keep targeted transcript readback after dispatch. Distinguish accepted,
transcript-confirmed, confirmation-delayed, uncertain, and failed. Never
blindly resend when dispatch may have landed.

### Slice 3 — native Stop Turn adapter (local complete)

Use the existing `thread.turn.interrupt` command and provider `turn/interrupt`
path. The VoiceTools requester/receipt wrapper, local endpoint, and exact
peer-host forwarding are now in place. The remaining work is the Portfolio
hung-turn workflow that may request Stop without blindly resending.

### Slice 4 — registration lifecycle cleanup

Keep one VoiceTools identity projection for discovery, but define explicit
pending/active/stale/retired observations and ensure duplicate aliases collapse
to one T3 thread. Do not create replacement sessions when registration is late.

### Slice 5 — Portfolio owner and paused Heartbeat foundation

Implement the single owner seam and truthful read/write behaviour. Keep all
Heartbeats paused during transfer and proof.

### Slice 6 — T3 health and workflow surfaces

Continue the read-only T3 Portfolio work: native token health, storage
categories, cleanup previews, and the hung-turn recovery workflow. Automatic
stop/resend remains unimplemented until the native Stop and duplicate-send
receipts are proven.

### Later — existing Realtime Assistant integration

The VoiceTools Realtime Assistant is existing future context. It is not part of
these messaging-foundation slices.

## Current unresolved facts

- The exact remaining normal-path call sites that invoke peer refresh or status
  after an exact Passport has been supplied need focused tests before removal.
- The local and exact peer VoiceTools interrupt paths exist; the Portfolio
  hung-turn policy and final cross-host operational receipt presentation remain
  unresolved.
- The registry has stable identity grouping, but its stale/retired lifecycle
  is implicit rather than an explicit contract.
- A real dispatch timeout can still be difficult to classify when both native
  acceptance and projected confirmation are delayed.
- Portfolio/Heartbeat authoritative ownership is not yet implemented in the
  current T3 slice.

## Source evidence

- VoiceTools Plan 547: direct message/readback contract and no pre-send gates.
- VoiceTools Plan 546: minimal direct Heartbeat sender and messaging
  simplification.
- VoiceTools Plan 562: exact visible title to Passport/owner route resolution.
- VoiceTools Plan 566: single Portfolio/Heartbeat state owner.
- VoiceTools Plan 567: native T3 Stop requester boundary.
- VoiceTools Plan 568: T3 storage and direct-dispatch audit.
- T3 `packages/contracts/src/environmentHttp.ts`: authenticated
  `/api/orchestration/dispatch` contract.
- T3 `packages/contracts/src/orchestration.ts`: native command schemas.
- T3 `apps/web/src/components/ChatView.tsx` and `ChatView.logic.ts`: visible
  Stop action and turn identity selection.
- T3 `apps/server/src/orchestration/decider.ts` and
  `apps/server/src/orchestration/Layers/ProviderCommandReactor.ts`: interrupt
  event and provider path.
- T3 `apps/server/src/provider/Layers/CodexSessionRuntime.ts`: Codex
  `turn/interrupt` request.
- VoiceTools `voicetools/api/server.py`, `codex_command_router.py`,
  `codex_command_service.py`, `t3_bridge.py`, `session_registry.py`, and
  `t3_session_registry_watcher.py`: current send and identity path.
