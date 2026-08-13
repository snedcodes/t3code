# T3 Mobile Assistant Provenance and Hydration Migration

## Purpose

Plan the migration of established VoiceTools assistant, realtime, completion,
and TTS capabilities into T3 mobile without replacing mature hydration work
with a generic summary or creating a second coordination backend.

This is a read-only provenance map and planning packet. It authorizes no
backend, mobile, TTS, realtime, or VoiceTools change.

## Migration principle

T3 native orchestration is the future thread, turn, message, and cross-host
coordination source. VoiceTools remains a temporary phone-only compatibility
layer. Preserve VoiceTools contracts that solve a real user problem; replace
only their backend-specific transport and duplicate identity layers.

## Existing assets and destination

| Capability | Current VoiceTools authority | Native T3/mobile destination | Decision |
| --- | --- | --- | --- |
| Logical session identity | Plan 556 canonical Passport contract; aliases, raw route keys, host identifiers, and event IDs are explicitly non-interchangeable. | T3 environment ID + thread ID; project/title only for display. | Adapt through one explicit binding. Do not carry old aliases/routing keys into the new identity model. |
| Assistant hydration | Plan 499/511 current/near/broad scopes; durable phone journal; start/end head fence; persisted source-count/warning receipt; realtime start fails closed without valid hydration. | Authenticated T3 thread detail, transcript, pending approval/input, project/worktree state, terminal turn state. | Reuse the scope/fence/receipt contract; map each source to native T3 data before implementation. |
| Realtime assistant | `AssistantRealtimeSessionController` carries context preference, follow-up context, attempt/conversation identity, tool routing, audio lifecycle, and transcript events. | T3 mobile currently has no equivalent realtime controller. | Extract/adapt the controller ideas and hydration gate; bind them to T3 environment/thread identity. |
| Completion attention | Plan 529 canonical completion identity, durable event/replay/ack lifecycle, timeline hydration before notification/TTS. | Native T3 terminal, approval, and input transitions; T3 mobile notification/deep-link and agent-awareness surfaces. | Reuse delivery receipts and idempotency; replace VoiceTools event producer/WebSocket presence route. |
| TTS | Separate card/sound/TTS policy; completion eligibility, post-hydration gate, burst coalescing. | No equivalent native T3 mobile policy queue currently. | Reuse phone-side queue/policy; consume native T3 attention events. |
| Phone commands | VoiceTools command proxy resolves Passport then routes to T3. | T3 mobile thread outbox and normal native turn dispatch. | Retire the VoiceTools proxy; future voice transcription fills the selected native T3 composer/send action. |

## Evidence anchors

- VoiceTools Plan 556: `VoiceToolsSuite/voicetools/DOCS/DEVELOPMENT_PLANS/556_CANONICAL_IDENTITY_AND_END_TO_END_SIGNAL_MAP_HANDOFF_2026-08-08.md`
- VoiceTools Plan 511: `VoiceToolsSuite/voicetools/DOCS/DEVELOPMENT_PLANS/511_MANDATORY_PHONE_ASSISTANT_HYDRATION_NOTIFICATION_RESTORE_AND_LEGACY_UI_REMOVAL_2026-07-30.md`
- VoiceTools Plan 529: `VoiceToolsSuite/voicetools/DOCS/DEVELOPMENT_PLANS/529_DURABLE_CROSS_HOST_COMPLETION_NOTIFICATION_DELIVERY_AND_PHONE_RECEIPTS_2026-07-31.md`
- VoiceTools hydration: `voicetools/api/plan499_hydration.py`, `plan499_assistant_hydration.py`, `plan499_server_seam.py`
- VoiceTools Android: `VoiceToolsUploader/app/src/main/java/com/voicetools/uploader/codex/plan499/`, `CodexAlertTts.kt`, `CodexAlertsService.kt`, `AssistantRealtimeSessionController.kt`
- T3 thread API: `packages/client-runtime/src/state/threadSnapshotHttp.ts`, `apps/server/src/orchestration/http.ts`
- T3 mobile attention: `apps/mobile/src/features/agent-awareness/`, `apps/mobile/src/features/threads/`, `apps/mobile/src/state/thread-outbox/`

## First bounded planning tranche

Create one visible T3 planning agent in the T3 Code project for **T3 mobile
assistant provenance and Plan-499 hydration migration map**. Its only output is
an implementation-ready Markdown plan that:

1. maps every Plan 499 source type and receipt field to exact native T3 origin;
2. identifies gaps rather than replacing them with generic summaries;
3. specifies the minimum native-T3 receipt that retains Current/Near/Broad,
   source counts, warnings, and head fencing;
4. maps event identity to environment + thread + terminal/turn identity with a
   durable device replay/idempotency key;
5. defines a return handoff from realtime voice to the native T3 thread.

It must not implement TTS, realtime, backend, notification, or phone changes.

## Explicit non-goals

- Recreating VoiceTools backend, Passport routing, alert WebSocket presence,
  or polling inside T3.
- Replacing existing scoped hydration with a generic thread summary.
- Beginning realtime implementation before the provenance map is approved.
