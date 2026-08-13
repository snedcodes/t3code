# Native T3 Sideband: Cross-Host Release

## Outcome

Ordinary agent coordination works through native T3 even when VoiceTools is
unavailable. A sender addresses an agent by its exact visible project and title;
the owning host resolves and dispatches the message through its local T3
orchestration server. SSH is transport only.

## Starting point

- Local implementation: commits `0551ad327`, `0b8bdef85`, and `656e9026b`.
- Local exact-title dispatch has already produced a normal orchestration
  receipt.
- The remote T3 installations do not yet contain the `sideband-send` command.
- A later local invocation exposed a real defect: the standalone CLI tried to
  write an administrative auth session into `state.sqlite` and hit a database
  lock. Native sideband must obtain its short-lived credential through the
  already-running local T3 server's supported auth surface, or otherwise share
  the server's normal serialization path. It must not open a competing local
  persistence writer and retry blindly.

## Scope

1. Repair the locked-local-auth path with a focused test that demonstrates the
   CLI does not compete with the live server for `state.sqlite`.
2. Inspect the three current sideband commits and focused tests.
2. Run only focused server checks needed for `sideband.ts` and `sidebandSsh.ts`.
3. Push the coherent reliability branch to the user fork; do not merge upstream
   or change official release tracking in this tranche.
4. Build and deploy the same reviewed T3 fork artifact to one non-critical
   remote host at a time through its documented owning-host route.
5. Prove one exact-title Mac-to-Windows and one Windows-to-Mac dispatch using
   `t3 sideband-send-ssh`, with the receiving thread's normal T3 receipt.
6. Record the installed source revision and both receipts in this plan or a
   short adjacent release receipt.

## Required behavior

```text
exact project + exact visible title
  -> local native T3 snapshot resolves exactly once
  -> normal local orchestration dispatch
  -> standard receipt

other host
  -> documented SSH alias
  -> same command executes on owning host
  -> owning host resolves and dispatches
  -> remote receipt returned unchanged
```

Unknown or duplicate titles stop. Callers never supply a thread ID. Do not edit
T3 SQLite, create a broker, add polling, or fall back to VoiceTools sending.

## Deployment sequence

1. Produce one immutable artifact/revision from the clean committed fork.
2. Install it on one non-critical Windows host without changing T3 user data.
3. Confirm `t3 sideband-send --help` and `t3 sideband-send-ssh --help` on that
   host. Do not claim cross-host readiness from a local build alone.
4. Dispatch one neutral message to an existing exact-title target on that host.
5. Deploy to the other Windows host and repeat in the opposite direction.
6. Only after both directions work, update operational instructions to name
   native sideband as the ordinary coordination path.

## Protected boundaries

- Do not alter VoiceTools backend, Portfolio state, phone features, or T3
  mobile in this tranche.
- Do not touch unrelated dirty files or existing T3 production user data.
- Do not resend an ambiguous/uncertain dispatch. Read the receipt first.
- A temporary SQLite lock is a native sideband repair signal, not authorization
  to fall back to VoiceTools for ordinary agent coordination.
- If a deployment needs a service restart or an installed-app replacement,
  use that host's documented owner and keep the prior artifact available for
  rollback.

## Acceptance

- Focused tests/checks pass.
- Same source revision runs locally and on both required remote hosts.
- One exact-title cross-host send succeeds in each direction with normal
  dispatch receipt evidence.
- VoiceTools can be unavailable without invalidating the proof.

## Handoff

Commit only files owned by this tranche. Report the fork commit, deployed
revision per host, focused validation, both receipts, and any remaining host
whose installed T3 is not yet compatible.

## Execution receipt — 2026-08-13

- Fork source revision: `ba8f77bea074925f47bb8498e4e50c8e5e7c0079`.
- Final server artifact: `apps/server/dist/bin.mjs`, SHA-256
  `8ed123f2fbe16d04e20c2850068dea4a748bfe9ad4a7297d2a53a30c780fe48a`.
- `agent-win-vps`: installed at the npm T3 bundle path; `sideband-send` and
  `sideband-send-ssh` help pass; rollback copy retained; no service restart.
- `agent-win-laptop`: installed at the app-unpacked server path; both help
  commands pass through the reversible Node 22 wrapper; rollback copy retained;
  no service restart.
- Mac-to-Windows VPS receipt: exact project `REPEATER_2026`, exact title
  `Repeater Coordinator`, sequence `117643`, status `dispatched`, transcript
  `{ acceptedUserMessage: true, receipt: "native-orchestration-dispatch" }`.
- The first VPS attempt failed before dispatch because the Windows SSH shell
  cannot execute POSIX quoting; read-only verification found no message, so it
  was not resent until the host-aware PowerShell transport fix was installed.
- Windows-to-Mac proof is protected and incomplete: documented SSH alias
  `agent-macbook` does not resolve from the rollout host, and no Mac-side T3
  CLI route is currently available through that alias. No undocumented alias,
  manual thread ID, Portfolio target, or VoiceTools fallback was used.

## Current state — 2026-08-13 follow-up

The tranche is not complete. The VPS receipt above proves only Mac-to-Windows
VPS. Windows-to-Mac remains blocked because the documented `agent-macbook`
alias does not resolve from the rollout host.

The prior bounded retry did not remove the underlying ownership defect: the
standalone CLI still instantiated `EnvironmentAuth` and issued/revoked bearer
sessions against its own `state.sqlite`. That was a competing writer beside
the running app server, even when retries avoided an observed lock.

### Next bounded implementation (owned and focused)

The CLI now uses the running server's app-owned auth surface:

1. `POST /api/auth/local-session` is loopback-only and calls the server's
   existing `EnvironmentAuth.issueSession` service.
2. The CLI uses the returned short-lived bearer token for the existing
   authenticated snapshot and dispatch calls.
3. `POST /api/auth/local-session/revoke` is loopback-only and calls the
   server's existing `EnvironmentAuth.revokeSession` service.
4. The CLI no longer provides `EnvironmentAuth`, opens auth persistence, or
   retries local SQLite writes. The server remains the sole auth persistence
   owner.

Focused coverage verifies the sideband target behavior, Windows/Mac shell
transport quoting, and loopback request guard. This implementation has not
been deployed or claimed as cross-host proof; a fresh artifact rollout and
live local-server auth-path verification are the next bounded checks before
any further host proof.
