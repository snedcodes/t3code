# Portfolio voice context rollout

Prepared 5 October 2026. Goal: voice attached to the existing Portfolio Overseer chat can retrieve current projects, agent history, documents and code across the user's enabled computer Connections, then draft and explicitly send instructions to that Overseer.

## Current evidence

| Environment          | Deployment                                                                                                                             | Next step                                                                       |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| VPS Dev              | Context, freshness, realtime conversations and attached-main tools deployed; real spoken document answer and message delivery accepted | Retain the working runtime and use it as the reference                          |
| Mac Alpha 0.0.45     | Private GUI startup/local Connection verified in isolation; Alpha live profile not switched                                            | Verify remote pairing, then prepare the actual existing-profile handover        |
| Windows Alpha 0.0.44 | Context/realtime backend candidate prepared on Mac; native target execution not accepted                                               | Probe the candidate in isolation and prepare a separate private desktop package |

Fresh unauthenticated POST probes on 5 October returned 401 for VPS `/api/context/read` and `/api/realtime/client-secrets`, and 404 for both routes on Mac and Windows. These establish a deployment boundary, not authenticated functional acceptance. Existing desktop Alpha apps and live profiles remain unchanged.

Context access already extends to other registered VPS projects/threads, including archived nondeleted threads; it is not limited to the attached chat. Draft/send is separately fixed to the attached main thread. The release backports support projects, threads and files, but return explicit unsupported status for `read_portfolio`: those releases have no canonical Portfolio owner. Use the VPS for canonical Tasks/Heartbeats/Wishlists rather than inventing desktop records.

## 1. Keep VPS working and prepare Mac first

- Preserve current VPS integration commit `27f9a9ed12775335a4240676fbf94dfe7db1478c`, exact environment identity, saved voice history, Portfolio records, Connections and audible completion TTS. No VPS restart or phone APK is required solely to expose desktop context.
- Use the existing private Mac candidate from release-compatible freshness source `2054d10d4a611cf3fa8e885a4087ae0ff9d42251`; do not rebuild passing backend/GUI work without a source change. Artifact receipt is retained under `/Users/snedmusic/snedcodes/t3-mac045-private-gui-artifacts-20261005` on the Mac.
- Verify its isolated profile, separate app/protocol identity, no publisher updater, basic GUI/backend startup and a deliberately paired Connection. A private empty profile does **not** contain the existing Mac Overseer or Alpha history. Successful isolated startup is preparation, not rollout completion.
- On 5 October the packaged private backend started with an explicit new isolated profile, loopback port and browser opening disabled; its bundled web page returned HTTP 200. The captured probe process was then stopped and its profile/logs retained. Alpha remained running. This verifies packaged backend startup, not GUI/login, existing-history access or authenticated context reads. The preceding help-only invocation timed out; the actual isolated startup probe succeeded.
- Resolve private login/OAuth compatibility if needed for the selected connection mode. Publisher passkeys are disabled in this ad-hoc candidate. Direct Tailscale pairing is an available verification path, but does not prove private T3 Connect/OAuth works.
- Following explicit user permission on 5 October, the separate private GUI opened with a new isolated backend profile and its separate Electron profile. Setup, Settings and Connections worked; local backend port 56063 was connected, and Add Environment opened its host/pairing-code form. Project import was skipped. Private environment `6c90069a-3d0e-4382-acdb-0e69224af5e6` is separate from live Alpha `4589bff7-63f7-431b-a92f-4d291f914de3` on port 3773. Remote pairing was subsequently verified as described below; private OAuth remains untested. The private app remains available on Connections; its backend and inspection port bind only to loopback. Alpha remained running with its original identity. This establishes GUI/local-connection acceptance, not the existing-profile handover or phone access to Mac history.
- Prepare one concrete handover: exact current Alpha owner/profile/port/environment, private runtime configuration, retained fallback and recovery command. Verify that the private runtime can select the intended existing profile without changing environment identity. After authorization, stop only the confirmed owner and start the chosen private runtime against that profile. Never run Alpha and private owners against the same profile.
- Preserve the official Alpha application bytes and updater. Rollback means stop the captured private owner, then resume Alpha against the retained profile; do not reset or replace the user's database. Confirm release-compatible state use before promising this fallback.

## 2. Then prepare and switch Windows

- Use the maintained shared private desktop source line for the next Mac and Windows versions: `sned/private-desktop-context-v045`, commit `5248a53ba82f087d6a6401961f86453674401cff`, based on official v0.0.45. It preserves the accepted freshness/context/realtime work and private app/profile/protocol/update identity in Git. The earlier Windows 0.0.44 backend at `d2c88f9f599d8dd7a0ad64c55b7bc642bb85b589` remains a historical candidate; it is not the ongoing Windows upgrade baseline.
- Run one isolated Windows target-load check using the release-compatible native dependencies. This is execution validation, not a Windows build. Resolve a concrete native-load failure if encountered.
- Assemble a separate private desktop package on Mac, retaining release-compatible Windows shell/native dependencies, separate application identity/profile defaults and no official updater feed. A backend bundle by itself is not a finished Windows GUI package.
- Prepare the same explicit single-owner handover and Alpha fallback as Mac. Do not silently replace the publisher-signed Alpha archives. Live switch remains a separately authorized step.

## 3. Permissions and Connections

- The current HTTP context endpoint requires existing authenticated `orchestration:operate` authorization, even though this tool is read-only. Reuse the existing cookie/bearer/relay DPoP paths; do not make a public endpoint or ask the user to paste credentials.
- Keep valid saved Connections and exact environment IDs. Re-pair using the existing authorization/QR flow only if a credential is invalid or the chosen private environment has a genuinely new identity. A green Connection does not establish tool availability.
- The host's T3 process needs normal read access to the selected workspace directories. Phone-wide file permission is not required for files read on another computer. Address a specific macOS protected-folder or Windows ACL denial if it occurs; do not grant blanket administrator access as a prerequisite.
- Keep portfolio access **On by default**, with the existing durable per-assistant opt-out. Source discovery includes enabled offline entries; an actual read requires that exact source to be enabled and connected. Explicit unavailable sources never fall back to another computer.
- Register the existing `context_read` MCP toolkit under each provider's authenticated environment boundary. MCP reads are local to that environment; phone federation uses its existing authenticated Connections. Registration alone does not prove every provider has invoked the tool.

## 4. Register useful sources

- Inventory each environment's existing T3 projects before adding anything. Retain their IDs and history; register missing repository roots or intentional document roots through normal T3 project operations. Do not duplicate existing projects or copy chats into a parallel store.
- Reads are project-relative and constrained to canonical real paths, including symlink containment. Documents outside all registered roots require a deliberate source registration; pairing does not expose the entire disk. Git hosting repositories that are not checked out/registered locally are not automatically readable.
- Use `list_projects` and `list_threads` to discover exact targets, then `search_files`/`read_file` for actual documents. Search is currently a path substring index, not semantic content search; its existing index ceiling is disclosed, and direct reads are not capped by that search index.
- For current status, request `read_thread` with `query: "recent"` on the installed voice tool. The service also accepts `view: "recent"`. Use default full canonical JSON for omitted fields/older details. Follow numeric `nextOffset` using the stated offset unit, and restart recent reads when snapshot sequence changes.
- Keep per-response limits of 100 items / 60000 characters, with no cumulative history/document quota. Startup hydration remains separate and bounded; request-driven retrieval selects additional content as needed. Unsaved/process-local content is not claimed as canonical history.

## 5. One representative acceptance per host, then real voice

After each handover, verify together:

1. Exact environment identity, intended owner/profile, retained GUI/backend readiness and saved Connections.
2. An authenticated list of real projects/threads, one current completed thread page and an older continuation; archived history remains reachable.
3. One real document/code file with correct project/path, metadata, content and continuation. Invalid credentials, wrong environment and outside-root paths must fail without fallback.
4. Existing coding/chat behavior still works. On VPS retain the canonical Portfolio Task/Heartbeat readback; on release desktops retain explicit unsupported Portfolio reporting.

Then use the installed phone assistant to retrieve one identified source from each available computer and describe what is current, historical, clipped or unavailable. Finally attach voice to the exact existing Mac chat **Portfolio Overseer 2 OCT** (thread `c808741a-fdc0-43b7-bde1-559051596352`, project `agents-dev-guidelines`), resolving its environment/project from actual discovery.

Ask it to summarize current portfolio priorities with named sources and read the latest relevant document. Draft a short instruction to the Overseer; send only on the user's explicit instruction, confirm its canonical message ID in that exact main chat, and distinguish delivery from an Overseer reply. This uses the existing attached-main message tools. Universal direct sends to arbitrary discovered agents are not part of context deployment.

## Completion and retained behavior

Completion is an actual useful cross-computer voice answer plus verified Overseer delivery, not just successful route probes. No claim of live process health follows merely from reading a file or chat; report runtime observations with their timestamps separately.

Preserve background calls/reconnect intent, headset routing, immediate microphone cleanup on End, cues, completion TTS, fixed controls/minimization, mutes/interrupt, canonical companion saves and all existing Connections/Portfolio state. Automatic phone updates must not restart an ongoing call. Builds stay on Mac, and only the two existing workers may be used, on GPT-6.1 Sol low reasoning.

This plan authorizes no desktop live switch by itself. AGENTS.md retains confirmation for changing live runtimes/replacing installed applications. Prepare the concrete result and exact handover first; the user approves that final consequential step. No broad test suite or new backend/store/scheduler is a prerequisite.

## Maintained upgrades

The accepted source lines, installed phone identity, prepared artifacts and required retained capabilities are recorded in `scripts/t3-dev-release-manifest.json`. [Prepare a Dev upstream upgrade](dev-upgrades.md) documents the command that merges one selected official release into a separate candidate while retaining the full fork delta. Preparation was exercised on 5 October against the desktop's already-integrated v0.0.45: it created a separate candidate at exact private commit `5248a53`, with no conflicts or pending merge, and did not move the working checkout or any runtime. This demonstrates candidate preparation, not compatibility with an untried newer release.

Desktop is currently based on v0.0.45; mobile/VPS still derives from v0.0.42. Alignment is pending. Compatible phone JavaScript updates use the existing private OTA channel; native changes need a Mac-built APK. The private desktop update feed is not implemented. Official Alpha remains separately installed and uses its official updater.

## Private Mac remote pairing verified

VPS activation completed at 06:28 UTC on 5 October at `f95898293739f068844e719aa31a259fff3e4f79`. The current owner retained the exact environment, recent context, managed web and canonical Portfolio IDs. Exact private/official renderer origins pass; an unrelated origin remains excluded. No phone APK or desktop artifact rebuild was needed for this CORS repair.

The real private Mac GUI then paired normally to the VPS and showed its Connection as Connected. Its first SSH-background launch could not save the catalog because macOS keychain interaction was disallowed (-25308). Reopening the same isolated app/profile through LaunchServices corrected that boundary, retaining encrypted secure storage; a fresh ordinary pairing grant succeeded. At 06:41 UTC the GUI opened this exact restoration thread and displayed canonical saved history, including the latest activation message. This is real GUI pairing/history acceptance, not just a header or API probe. No provider turn was started; the provider-status check displayed a timeout, so agent-launch acceptance is not claimed. Private OAuth remains untested.

The private GUI remains on its isolated profile, loopback backend port56063 and private Electron profile. Alpha still owns the existing Mac profile and port3773; Mac/Windows context routes remain undeployed. Existing-profile selection, encrypted catalog compatibility and retained Connections must be accounted for in the next single-owner handover. The previously observed active Bybit candle backfill must be checkpointed before any approved switch. No Alpha quit, live profile switch, database replacement or credential transfer has occurred.
