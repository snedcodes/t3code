# T3 Git fetch reliability repair

Date: 31 July 2026  
Status: implementation checkpoint; Windows validation remains external and approval-gated

## Incident basis

The July 28 audit identified a 30-second automatic upstream status refresh in
`apps/server/src/vcs/VcsStatusBroadcaster.ts` and a five-second background
fetch in `GitVcsDriverCore.ts`. The July 31 Windows incident confirmed that
repeated interrupted/non-space-safe fetches left thousands of `tmp_pack_*`
files until the T3 process tree was stopped. Windows T3 is contained outside
this checkout; no affected repository is modified here.

## Repair contract

- Background fetches treat non-zero Git exits, timeouts, and low-disk state as
  failures. The existing broadcaster backoff therefore applies instead of
  treating `ENOSPC` as a successful refresh.
- A 512 MiB free-space floor pauses background fetch before Git starts pack
  construction. If the platform cannot provide disk statistics, the fetch is
  paused closed while status reads continue.
- Existing cache single-flight remains keyed by canonical Git common directory
  and remote. It coalesces concurrent refreshes in one server process; this is
  not a substitute for running two T3 servers against one repository.
- Effect's Node child-process layer already terminates the process group on
  interruption (`taskkill /T /F` on Windows and process-group signals on Unix).
  Timeout coverage must retain this behavior.
- Temporary-pack cleanup is explicit only. It scans `tmp_pack_*`, refuses
  without operator approval, refuses without a caller assertion that T3/Git are
  quiescent, rechecks Git lock files, removes no normal packs, and returns a
  compact observable receipt. Automatic status refresh never invokes cleanup.
- A zero `automaticGitFetchInterval` continues to mean no upstream fetch after
  the initial remote load; the existing local-status polling behavior is kept.

## Focused proof gate

Run only the server tests for the fetch safety and broadcaster behavior, then
format/typecheck the server scope. Before any Windows build is installed,
perform a disposable Windows proof with automatic fetch enabled: a failing
fetch must produce one failure/backoff event rather than a success; low disk
must prevent Git launch; timeout must leave no Git descendants; and the
explicit maintenance receipt must refuse while the process tree is active.

The Windows Nightly must remain stopped during repository recovery. After a
backup and a quiescent-process check, cleanup is an operator action outside
this checkout. The future operator command is:

```text
node apps/server/scripts/t3-git-temp-pack-maintenance.mjs --pack-directory <repo>/.git/objects/pack
```

That is diagnostic-only. Cleanup additionally requires
`--allow-cleanup --confirm-no-git-processes`; do not validate by fetching the
affected repository.
