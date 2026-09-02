import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
const base = "/Users/snedmusic/.t3";
const bin = "/Users/snedmusic/.local/share/t3-toolchains/node-v24.19.0-darwin-x64/bin";
const env = { ...process.env, PATH: `${bin}:${process.env.PATH}` };
let session;
try {
  const issue = execFileSync("npx", ["--yes", "t3@0.0.33", "auth", "session", "issue", "--base-dir", base, "--ttl", "30m", "--label", "codex-message", "--subject", "T3 Mobile Realtime Client 26 Aug", "--json"], { env, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  session = JSON.parse(issue);
  const token = session.token;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const descriptor = await (await fetch("http://127.0.0.1:3773/.well-known/t3/environment", { headers })).json();
  const snapshot = await (await fetch("http://127.0.0.1:3773/api/orchestration/snapshot", { headers })).json();
  const environmentId = descriptor.environmentId;
  const project = (snapshot.projects ?? []).find((p) => p.title === "T3 Code Reliability" && !p.deletedAt);
  const thread = (snapshot.threads ?? []).find((t) => t.projectId === project?.id && t.title === "T3 Build Coordinator 24 Aug Successor" && !t.deletedAt && !t.archivedAt);
  if (!project || !thread) throw new Error(`exact target not found projects=${JSON.stringify((snapshot.projects ?? []).map((p) => p.title).filter((x) => /T3|Reliability|Code/.test(x)))} threads=${JSON.stringify((snapshot.threads ?? []).map((t) => t.title).filter((x) => /Coordinator 24 Aug|Realtime Client/.test(x)))}`);
  const text = `T3 Mobile Realtime Client 26 Aug -> T3 Build Coordinator 24 Aug Successor

FINAL RECEIPT

Completed direct VoiceTools-behavior mobile slice in the owned realtime files. Changed:
- apps/mobile/src/features/realtime-assistant/realtimeAssistantTransport.ts — T3-authenticated client-secret bootstrap, direct OpenAI Realtime WebSocket, session configuration, PCM input_audio_buffer.append, response audio delta, speech-start response.cancel/barge-in, lifecycle/error/close cleanup, marin voice, low semantic VAD, near-field noise reduction, gpt-realtime-2.
- apps/mobile/src/features/realtime-assistant/realtimeAssistantController.ts — 24 kHz/PCM frame path, 900 ms startup capture gate, 450 ms playback echo gate, bounded frames, mic/assistant mute, playback interruption/stop and failure cleanup.
- apps/mobile/src/features/realtime-assistant/RealtimeAssistantRouteScreen.tsx — normal prepared bearer connection POST bootstrap and direct route wiring; existing native capture/playback bridge remains the audio boundary.

Bootstrap is POST /v1/realtime/client_secrets on the authenticated T3 environment with {threadId, projectId, session}; the returned ephemeral client_secret is used only by the phone for wss://api.openai.com/v1/realtime. Codex scheduler realtime is absent from the active voice route and no synthetic events or second backend transport are used. VoiceTools lifecycle behaviors ported: startup/playback suppression, semantic VAD, PCM capture/playback, output delta playback, speech-start barge-in, mute, stop, close/error cleanup.

Validation: the first focused controller test caught and I removed a duplicate gate declaration; the subsequent VPS vp test invocation produced no result within the bounded run, so no pass is claimed. Scoped mobile typecheck was not completed because the same remote runner became non-responsive; source audit confirms no scheduler transport/useAtomCommand in the active realtime route.

Remaining physical acceptance: run the installed Android/native module build on a phone or emulator with microphone permission, T3 API key configured on the server, and verify the real OpenAI WebSocket/audio route end to end.`;
  const payload = { type: "thread.turn.start", commandId: randomUUID(), threadId: thread.id, message: { messageId: randomUUID(), role: "user", text, attachments: [] }, runtimeMode: thread.runtimeMode, interactionMode: thread.interactionMode, createdAt: new Date().toISOString() };
  const sent = await (await fetch("http://127.0.0.1:3773/api/orchestration/dispatch", { method: "POST", headers, body: JSON.stringify(payload) })).json();
  const readback = await (await fetch(`http://127.0.0.1:3773/api/orchestration/threads/${thread.id}`, { headers })).json();
  const visible = JSON.stringify(readback).includes(payload.message.messageId);
  console.log(JSON.stringify({ environmentId, projectId: project.id, threadId: thread.id, sequence: sent.sequence, accepted: sent.sequence !== undefined, visible }));
} finally {
  if (session?.sessionId) { try { execFileSync("npx", ["--yes", "t3@0.0.33", "auth", "session", "revoke", session.sessionId, "--base-dir", base], { env, stdio: ["ignore", "ignore", "ignore"] }); } catch { console.error(JSON.stringify({ revocationFailed: session.sessionId })); } }
}
