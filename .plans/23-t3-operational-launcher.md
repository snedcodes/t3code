# Plan 489 Gate A: T3 Operational desktop launcher

Status: prepared; desktop launch remains intentionally blocked while legacy T3
is live.

The user-facing entry point is `scripts/T3 Operational.command`. It resolves
only `/Users/snedmusic/.t3-operational`, database
`/Users/snedmusic/.t3-operational/userdata/state.sqlite`, Electron identity
`com.t3tools.t3code.operational`, Electron user-data
`~/Library/Application Support/t3code-operational`, server port `3774`, and
web port `5174`. It starts the normal desktop UI through the repository's
desktop dev runner, not a headless server.

`node scripts/t3-operational-launcher.mjs --diagnose` is read-only and refuses
when the legacy listener on `3773` or legacy database is owned. On 27 July
2026 it refused as designed: legacy T3/Nightly PID 29859 owned both. The
operational listener and database had no owners. Therefore no desktop launch
was attempted while the legacy profile remained live.

Rollback is documented in `scripts/T3 Operational Rollback.md`: stop
Operational, verify port `3774` is released, then reopen the existing legacy
application alone. Neither launcher modifies the legacy database or archives.

Focused isolation/preflight tests passed (6 tests), desktop typecheck passed,
formatting and diff checks passed. Final controlled desktop/read proof requires
the user to close legacy T3 first; no imported-thread message will be sent by
Gate A.

## Append-only handover top-up

Using a fresh read-only SQLite online backup at
`/Users/snedmusic/t3-archives/2026-07-27-topup/state-current-topup.sqlite`
(SHA-256 `9705a5bb32f7b0de91e7437436ff3cc6cda5501e99d336e5260e8734a387c39e`,
`quick_check: ok`, migration 34), the provenance-driven append tool updated
only Portfolio Overseer and T3 Reliability Fork Agent.

Receipt: `/Users/snedmusic/t3-archives/2026-07-27-topup/topup-receipt.json`.
Portfolio Overseer moved from 972 to 1,008 messages (36 inserted, 972
duplicates). T3 Reliability moved from 79 to 97 messages (18 inserted, 79
duplicates). A repeat run inserted 0 messages. Titles, projects, workspace
roots, provenance rows, and all other six imported threads were unchanged.
The newest source/target message windows match for both threads and target
`quick_check` is `ok`. No provider, desktop, VoiceTools, or legacy operation
was performed.
