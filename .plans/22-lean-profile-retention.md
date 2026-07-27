# Plan 487 fork-local retention guard

Status: implemented and proven on disposable state only; real active-roster
import remains approval-gated.

`apps/server/scripts/t3-retention-maintenance.mjs` owns a profile-local
`userdata/retention-policy.json` with the Plan 487 defaults: 200 activities
per thread, 500 orchestration events per thread, compact `tool.completed`
receipts, and 25 MiB/three-generation/14-day log rotation. It refuses the
shared `.t3` profile, known legacy/backup paths, missing databases, and a live
profile identified by `userdata/server-runtime.json`. It reports policy,
database/log sizes, relevant counts, protected tables, and a JSON receipt.

The command prunes only `projection_thread_activities` and thread-scoped
`orchestration_events`; completed tool payloads are compacted in those
operational rows. It never deletes message, project, thread, or
`t3_selected_thread_imports` provenance rows. No continuous scanner or
background loop is wired in; maintenance is explicit and bounded.

Direct disposable proof passed with synthetic rows over deliberately tiny
policy limits. Activity/event windows were reduced to 2 rows per thread,
tool payloads became compact receipts, a log over the 50-byte test threshold
rotated, and message/project/thread/provenance counts and message text were
unchanged. The legacy paths were not used.

Future isolated operational command:

```sh
node apps/server/scripts/t3-retention-maintenance.mjs --profile /Users/snedmusic/.t3-operational
```

Readiness: ready to run this guard on a newly created operational profile;
not ready for automatic real-roster import until the profile is created,
retention receipt is reviewed, and the user gives explicit roster approval.
