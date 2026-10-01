# Realtime assistant source

The Android assistant uses the canonical T3 environment for authentication and
thread context. The server bootstrap is `POST /api/realtime/client-secrets`,
with `{ projectId, threadId, selectedMessageId?, documentPaths? }`. It requires the existing
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
instructions. Up to three explicitly selected project-relative Markdown files
are read through the canonical project root, including symlink containment.
Snippets are bounded to 16 KiB per file and 32 KiB total, independently of the
history budget. Missing, unreadable and clipped files produce warnings. Only
relative paths, titles, included byte counts and clipping appear in response
provenance; text is supplied in the trusted server-built context. Portfolio
Tasks and attachment contents remain unhydrated and explicitly warned.

The mobile controller accepts an injected transport tied to one immutable
project/thread target. It owns session state, both mutes, interruption,
transcript snapshots and terminal cleanup. Stopping preserves the transcript;
a fresh start clears it and resets mutes. Generation fencing ignores late
callbacks and closes stale starts before another session can use the transport.
It has no provider PCM/RPC coupling or arbitrary capture-delay timers.

The shared authenticated caller and mobile `useRealtimeBootstrap` hook reuse
the current prepared environment, including cookie/bearer authentication and
one DPoP refresh with a new POST proof against the refreshed origin. Ephemeral
credentials are returned to the transport without a persistent/query cache.

The protocol transport negotiates WebRTC using an injected platform boundary:
microphone acquisition, peer connection, `oai-events` channel, ephemeral-token
SDP exchange and an actual `session.created` ID. It handles input/output
transcripts, both mutes, response cancellation/output-buffer clear and terminal
track/peer cleanup. The server enables input transcription using
`gpt-4o-mini-transcribe`; the client does not supply arbitrary model/settings.

The concrete React Native WebRTC/audio adapter, phone permission/UI entrypoint
and durable voice transcript remain unfinished. There is no usable phone
voice entrypoint yet. Android native builds and handset verification run on
the MacBook only. Mocked transport/HTTP checks do not prove microphone,
speaker, interruption or an OpenAI session on the real handset. No existing
Portfolio visuals, provider adapters, scheduler or notification path change.
