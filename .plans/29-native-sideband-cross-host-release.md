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

## Scope

1. Inspect the three current sideband commits and focused tests.
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
