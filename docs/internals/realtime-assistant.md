# Realtime assistant source

The Android assistant uses the canonical T3 environment for authentication and
thread context. The server bootstrap is `POST /api/realtime/client-secrets`,
with `{ projectId, threadId, selectedMessageId? }`. It requires the existing
orchestration operate scope and accepts the environment's normal bearer,
DPoP or browser-session authentication. The route validates the exact active
project and thread before minting; missing selection has no fallback.

`OPENAI_API_KEY` is read on the server only. The bootstrap sends a fixed
Realtime session configuration to OpenAI and returns only a temporary
`clientSecret`, Unix-second `expiresAt`, model, context provenance and warnings.
Responses are not cached. The current source configuration uses
`gpt-realtime-2.1` and `marin`, following the official
[WebRTC guide](https://developers.openai.com/api/docs/guides/voice-webrtc).
Account access and actual upstream requests have not been verified.

Context contains recent canonical user/assistant messages, a specifically
selected message and latest-turn facts. Source IDs, timestamp, counts and
clipping are reported. Conversation text is source material, not system
instructions. Project documents, Portfolio Tasks and attachment contents are
not retrieved yet; explicit warnings travel with the session bootstrap.

The mobile controller accepts an injected transport tied to one immutable
project/thread target. It owns session state, both mutes, interruption,
transcript snapshots and terminal cleanup. Stopping preserves the transcript;
a fresh start clears it and resets mutes. Generation fencing ignores late
callbacks and closes stale starts before another session can use the transport.
It has no provider PCM/RPC coupling or arbitrary capture-delay timers.

The Android WebRTC transport, authenticated mobile bootstrap caller, native
audio routing, permission/UI wiring and durable voice transcript are not
implemented in this source slice. There is no usable phone voice entrypoint
yet. Android native builds and handset verification run on the MacBook only.
The implementation and injected transport/HTTP checks do not prove microphone,
speaker, interruption or an OpenAI session on the real handset.
