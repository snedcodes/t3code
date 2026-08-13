# Native T3 Sideband Dispatch

## Goal

Keep ordinary coordinator-to-agent messages available when VoiceTools is unavailable.
VoiceTools remains a phone alert/control integration; it must not be the only
path into a T3 thread.

## Small target

Provide one supported command that accepts an exact visible T3 title and a
message, resolves that title on the owning T3 host, invokes that host's normal
orchestration dispatch API, and returns the standard dispatch/transcript
receipt.

For a remote host, SSH is transport only. The command runs the same local
sideband command on that host. It must never write T3 SQLite directly or ask
callers to provide a thread identifier.

## Constraints

- Exact title must resolve once; unknown or duplicate title stops.
- Resolution, dispatch, and receipt happen on the owning host.
- Use the existing T3 orchestration command/API and authentication model.
- No persistent broker, database, queue, watcher, or parallel registry.
- Keep the existing VoiceTools sender as a phone/control integration, not the
  required path for T3 coordination.
- Preserve explicit protected actions and existing receipt/readback semantics.

## Delivery slices

1. Read-only local proof: resolve one exact title and obtain the existing local
   orchestration dispatch contract without VoiceTools.
2. Local command: send to one local target and return its normal receipt.
3. SSH transport wrapper: invoke the local command through the documented host
   aliases; prove one Mac-to-Windows and one Windows-to-Mac receipt.
4. Change the live T3 coordination instruction to prefer this path for
   ordinary agent coordination, with VoiceTools retained for phone features.

## Acceptance

With VoiceTools backend stopped or unavailable, an exact-title message reaches
an active T3 thread on another configured host and returns a dispatch plus
transcript receipt. No manual thread identifier, SQLite mutation, or new
persistent service is involved.

## Non-goals

- Replacing T3's native authentication, orchestration server, or mobile app.
- Building a portfolio queue, monitoring daemon, or general message bus.
- Migrating phone TTS/realtime work in this tranche.
