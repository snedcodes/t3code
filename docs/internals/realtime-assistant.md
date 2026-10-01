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

Android threads now offer a Voice assistant action in the existing header.
The sheet binds to the exact environment/project/thread, offers recent history
or an explicit message plus optional Markdown paths, and shows included context
and warnings. Start requests microphone access; Stop, close, target change,
backgrounding and audio focus loss release the voice session. Both mutes,
interruption, automatic handset/headset routing, explicit speaker routing and
bounded transcripts are exposed using the existing mobile styles.

The concrete adapter uses `react-native-webrtc` 124.0.8 and
`react-native-incall-manager` 4.3.0. Dependencies are declared and locked;
native installation and rebuilding belong on the MacBook. Availability is
probed without loading those packages on older native builds. Local capture
cleanup releases tracks/stream containers, not just their enabled flags.
WebRTC plays remote audio natively without a video view. Android audio focus
and routing are acquired and restored around the foreground session.

Voice entry stops the current completion TTS cue without changing its saved
preference. Existing foreground notification suppression remains intact;
background notification speech resumes normally after the voice call stops.
Android dictation currently has no local transcriber, so this slice does not
replace the composer dictation controller or change its other surfaces.

The Android library exposes no JavaScript native playout-buffer flush. The
transport sends OpenAI's `output_audio_buffer.clear`; a short native audio tail
remains a handset verification concern. Background voice calls and durable
transcript persistence are outside this foreground slice. Transcripts remain
for review until the sheet closes.

Android native builds and handset verification run on the MacBook only.
Source/type/mock checks do not prove microphone, speaker, audio routes,
interruption or an OpenAI session on the real handset. The Android library and
React Native 0.86 compatibility still need native compilation. The running
server also needs this source bootstrap and server-side OpenAI configuration
before a real call can succeed. Existing Portfolio visuals, provider adapters,
scheduler and notification receiver/service are unchanged.
