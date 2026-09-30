# Native Portfolio API: current Task and Heartbeat writes

VPS Dev owns Portfolio records at `http://127.0.0.1:3774`. Keep the bearer
credential on VPS Dev at `.t3-dev/operator/message-bearer.token`. Do not write
Portfolio state directly to files or the database.

## Tasks

Read `GET /api/portfolio/tasks` and select the exact `taskId`. The current
contract stores `ownerPassportId` and `ownerHost` at the Task's top level.

Create or update with one revision-checked full-record write:

```json
{
  "expectedRevision": 3,
  "task": {
    "taskId": "existing-task-id",
    "title": "Task title",
    "outcome": "Required outcome",
    "target": {
      "environmentId": "exact-environment-id",
      "projectId": "exact-project-id",
      "threadId": "exact-thread-id"
    },
    "status": "in_progress",
    "priority": "normal",
    "ownerPassportId": null,
    "ownerHost": "vps-dev",
    "checklistItems": [],
    "completionCondition": "Observed completion condition",
    "planLinks": [],
    "evidenceLinks": [],
    "createdAt": "2026-09-30T00:00:00.000Z",
    "updatedAt": "2026-09-30T00:00:00.000Z",
    "completedAt": null,
    "revision": 3,
    "lastReceipt": null,
    "heartbeatId": null
  }
}
```

Send that object to `POST /api/portfolio/tasks`. Set `expectedRevision` to the
revision just read, preserve the exact target and immutable identity, and send
the complete current record with only intended fields changed. The owner
increments `revision`; read the Task back and verify the new revision and
fields. On a stale revision, read again and merge once. Do not use legacy
`/api/portfolio/tasks/update` or `/api/portfolio/tasks/status` routes.

Task lifecycle changes use the same full-record route. The valid statuses are
`draft`, `ready`, `in_progress`, `blocked`, `complete`, and `cancelled`.
Completing, blocking, or cancelling a linked Task stops its Heartbeat. A
delivery receipt is server-owned evidence; preserve it when changing Task
work.

## Heartbeats

Read `GET /api/portfolio/heartbeats` and select the exact `heartbeatId`. Current
records use `status` and `revision`; `enabled` and `activeRunId` are legacy view
fields, not server API fields.

Create or update with one revision-checked full-record write:

```json
{
  "expectedRevision": 2,
  "heartbeat": {
    "heartbeatId": "existing-heartbeat-id",
    "taskId": null,
    "message": "Continue the assigned work and report evidence.",
    "target": {
      "environmentId": "exact-environment-id",
      "projectId": "exact-project-id",
      "threadId": "exact-thread-id"
    },
    "status": "active",
    "cadenceMinutes": 15,
    "nextRunAt": "2026-09-30T00:00:00.000Z",
    "maxRuns": 8,
    "runCount": 0,
    "expiresAt": "2026-09-30T02:00:00.000Z",
    "stopConditions": ["Task complete, blocked, or cancelled", "Operator turns this Off"],
    "preventOverlap": true,
    "stopReason": null,
    "lastReceipt": null,
    "updatedAt": "2026-09-30T00:00:00.000Z",
    "revision": 2
  }
}
```

Send that object to `POST /api/portfolio/heartbeats`. Use
`expectedRevision: null` only for a new ID; otherwise use the revision just
read. The owner increments `revision`; read the exact Heartbeat back after the
write. `active` means On. To turn a Heartbeat Off, set `status` to `paused`,
`nextRunAt` to `null`, and `stopReason` to a useful explanation. Preserve its
receipt and current run count. Terminal statuses include `stopped`,
`completed`, `blocked`, `expired`, and `exhausted`; do not turn these into a
second scheduler or overwrite them with a stale record.

An active Heartbeat needs an exact target, positive cadence, and a non-null
`nextRunAt` (set it to now to request the first delivery). Keep
`preventOverlap: true` for recurring work. Read back `lastReceipt`, `runCount`,
`nextRunAt`, and `status` to confirm delivery. The canonical server scheduler
owns due Heartbeats; the web UI does not own a second scheduler.
