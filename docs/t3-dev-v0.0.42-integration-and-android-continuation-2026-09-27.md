# T3 Dev v0.0.42 integration and Android continuation

Date: 27 September 2026
Updated: 28 September 2026
Status: active execution plan for the authoritative VPS Dev source

## Outcome

Bring the VPS custom T3 Dev build onto the upstream v0.0.42 stable base without losing native cross-machine messaging, Tasks, Heartbeats, or the existing phone work. Keep the current Dev build usable while a separate integration lane is built. The active tranche ends after the v0.0.42 VPS Dev handover in phase 4. Android, TTS and realtime voice remain documented future work and require a separate Mac-hosted assignment.

This plan does **not** schedule desktop/web realtime voice, desktop/web TTS, a desktop assistant panel, or any mobile build in the active tranche. Android assistant-panel and audio work are later phases, not prerequisites for the v0.0.42 web integration.

## Active coordination and build boundary

- A persistent coordinator may run from Mac Alpha on T3 0.0.40. The Mac does not need a T3 upgrade before it can coordinate through native messaging, Git and the existing `agent-win-vps` SSH route.
- Visible implementation workers run locally on the VPS so source edits, web/server execution and focused tests use the owning machine. Worker model selection is GPT-6 Luna with high reasoning unless the user explicitly chooses otherwise.
- Assign one bounded phase at a time. The first VPS worker owns phase 1 only and stops after returning its baseline evidence to the Mac coordinator. Later phases require a fresh explicit assignment after coordinator review.
- The VPS must not run Android, Gradle, Expo, Metro, EAS, emulator or mobile-native build commands, install Android SDK components, or build/validate T3 Code Mobile. During phases 1-4, VPS workers must not edit `apps/mobile`.
- All T3 Code Mobile, Android and native-phone implementation, builds and device validation run on the Mac under a separate later assignment. Phase 5 is a handoff boundary, not automatic continuation for a VPS worker.

## Current source truth

- Authoritative checkout: `C:\Users\Administrator\src\t3-snedcodes-dev-git`, branch `sned/t3-portfolio-control-dev-2026-08-21`. At plan creation HEAD is `83566d4bd`; the running custom source is based on T3 0.0.33.
- Runtime: VPS Dev server on port 3774 and Vite web frontend on 5733. Mac Alpha remains a separate stable coordination environment.
- Upstream target: official stable `v0.0.42`, not the older v0.0.40 target in the 15 September worker report. Its release includes the intervening upstream changes; do not port v0.0.41 as a separate layer.
- Existing dirty exclusions: the three `packages/effect-codex-app-server/src/_generated/{meta,namespaces,schema}.gen.ts` files and untracked `userdata/` belong to existing work/runtime. Preserve them. Assess whether the generated protocol changes are still needed against the chosen Codex pin; do not copy them blindly or discard them as mere noise.
- The VPS had about 10 GB free after the 28 September cleanup. Verify current free space once before dependency installation, use one integration worktree, and avoid mobile dependencies, installers and broad build artifacts. Do not delete existing checkouts or runtime data by assumption.
- The old VPS `docs/t3-portfolio-control-current-work-index-2026-08-17.md` describes a pre-scheduler stage and is historical context, not a statement of current capability.

Native T3 readback of the existing `T3 VPS Task Lifecycle Assessment 30 Aug` thread in project `T3 Dev VPS Source` covered 50 recent messages (31 August–15 September; latest turn completed 15 September). It reported a five-run VPS-to-Mac Task-linked Heartbeat acceptance with checklist/evidence updates and automatic Off at Task completion. That report is context; the current source contains the Task owner, Heartbeat scheduler, API and tests, while the integration lane must repeat one real end-to-end acceptance before replacing Dev.

## Work order

### 1. Establish the v0.0.42 integration base

Create a separate branch/worktree from the exact upstream `v0.0.42` tag. Keep the current source branch and its running profile intact. Run the upstream web app in an isolated state directory and separate ports; confirm pairing, one Codex provider, model list, one thread, and a follow-up turn. Do not point two T3 server owners at the live `.t3-dev` profile.

Compare the upstream connection, authentication, provider, web chat and contracts paths with our custom branch. Carry forward only custom behavior upstream does not already provide. Mobile comparison and implementation are deferred to the Mac-hosted mobile lane. This is a source-port, not a direct merge of the 0.0.33 branch; the 15 September worker estimated roughly 36 direct-merge conflicts against v0.0.40, and v0.0.42 needs its own fresh comparison.

Result: an upstream-current web baseline that runs independently while today's Dev remains available.

### 2. Restore our native cross-machine control

Integrate our exact environment/project/thread targeting, remote-connection and native messaging behavior into the new base. Reuse upstream connection/relay changes where they now cover our need; do not preserve duplicate registries or VoiceTools/Sideband send paths. Prove one Mac↔VPS exact-thread send/readback through native T3. Keep Mac Alpha stable.

Result: agents can still identify and message the right visible T3 threads across computers.

### 3. Port the complete Tasks and Heartbeats slice

Move the necessary contracts, VPS owner persistence/API, scheduler, client-runtime operations, web Portfolio views and focused tests together. Retain:

- editable Task detail, checklist/evidence progress, status and assigned exact target;
- standalone or Task-linked recurring Heartbeats, custom editable message with fallback prompt, cadence/lifecycle, receipts and readback;
- same-ID Task and Heartbeat updates, Task-completion/blocked/cancelled shutoff, and native `thread.turn.start` delivery;
- human environment labels and the existing presentation choice where it remains useful.

Run focused owner/contract/web tests, then one representative real flow: create or update a Task, attach a Heartbeat to an exact existing thread, observe a due native delivery and receipt, update checklist evidence, complete the Task and confirm the Heartbeat is Off. Do not add a second scheduler or messaging backend.

Result: the upgraded web Dev can replace the old build for everyday Tasks and Heartbeats, subject to the single-instance Dev handover.

### 4. Switch the VPS Dev owner to the integrated source

After phases 1–3 work, make a deliberate single-owner Dev handover to the integrated source using the existing VPS lifecycle owner. Preserve the current branch as a source rollback and preserve the live profile. Check the paired web UI, provider, remote environments, one existing Task/Heartbeat and exact-thread messaging after the handover. Do not combine this with a Codex CLI update, profile rewrite or phone-app replacement.

Result: v0.0.42-based VPS Dev is the working source build. The old branch remains recoverable.

### 5. Hand off Android phone experience to the Mac

This phase is deferred and requires a separate Mac-hosted worker after the web/Portfolio upgrade. It does not hold up phase 4 and must not run on the VPS. Use `docs/t3-voicetools-audio-to-native-t3-transfer-map-2026-08-26.md` in the Mac reference tree, the central VoiceTools Android scope split, and the retained VoiceTools source as the behavior reference. First ensure the upgraded server still has the authenticated, exact-thread ephemeral OpenAI Realtime client-secret route. Keep the long-lived API key server-side.

Port the VoiceTools-style assistant into the T3 Android thread as a slideable panel tied to that same environment/project/thread. Selecting a message must make it the panel's immediate context. Retain its assistant transcript, start/stop, mic and assistant mute, status, VAD profile, interruption, reconnect and cleanup. Implement the missing native Android `T3RealtimeAudio` microphone, PCM playback and audio-routing module behind the existing mobile bridge. The active assistant should use direct OpenAI Realtime (`gpt-realtime-2` unless a newer user-selected model supersedes it), **not** Codex app-server realtime, generic dictation, VoiceTools backend or a new broker.

Carry forward opt-in Android spoken-completion TTS as a separate feature: one native T3 completion should produce one correctly labelled spoken cue and open the same thread from its notification. Verify the assistant on a physical Android phone with one spoken exchange, streamed reply, interruption, mute and clean stop. Do not claim completion from source tests or a screen alone.

Result: the phone has the familiar thread-bound assistant and TTS behavior without VoiceTools as a runtime dependency.

## Deferred

Desktop/web realtime voice, desktop/web TTS, and the desktop assistant drawer are out of this tranche. iOS audio/TTS can follow Android acceptance. VoiceTools historical source stays available as reference; its messaging, Passport/session broker, sideband and parallel Agent Chats do not return to the live T3 path.

## Agent handoff

The Mac coordinator should fetch this exact pushed plan and assign phase 1 to one visible VPS worker using GPT-6 Luna with high reasoning. That worker should inspect current branch/status and free space, select one integration location, and deliver the smallest running v0.0.42 web baseline with isolated state and ports. It must not port custom features, touch the live `.t3-dev` profile, stop the existing Dev owner, edit mobile source, run mobile tooling, or continue into phase 2 without a new assignment.

For every phase, checkpoint meaningful source/doc/test work to Git and report `COMPLETE`, `NEEDS INPUT`, or `BLOCKED` with exact files, focused results and the required real-use receipt. The coordinator checks the authoritative source/runtime evidence before assigning the next phase. Do not treat this document, a worker transcript or message acceptance as proof that a runtime feature works today.

References: official `https://github.com/pingdotgg/t3code/releases/tag/v0.0.42`; VPS `docs/t3-portfolio-control-current-work-index-2026-08-17.md` (historical); Mac reference `docs/t3-voicetools-audio-to-native-t3-transfer-map-2026-08-26.md`; central `018_T3_TASKS_HEARTBEATS_VOICE_AND_AGENT_WORKFLOW_2026-08-26.md` (older sequencing).
