# T3 Fork Portfolio Extension and Rolling Release Plan

## Outcome

Use T3 Code as the primary coding-operations application while continuing to
take regular upstream T3 updates. Portfolio capabilities are a small extension
layer in the fork, not a separate backend or a rewrite of T3 core.

Immediate critical path: finish and deploy native T3 sideband messaging across
hosts. Portfolio features do not block it.

## Architecture

```text
upstream pingdotgg/t3code
  -> small reviewed fork delta
  -> immutable custom T3 release artifact
  -> rolling host deployment

native T3
  -> threads, turns, projects, provider state, normal dispatch

portfolio extension layer
  -> portfolio view, tasks, heartbeats, rants capture, trajectory, project notes

T3 mobile
  -> native coordination/attention first; selected VoiceTools capability migration later
```

VoiceTools is not a dependency for agent coordination. It remains frozen as a
temporary phone-only compatibility layer while native T3/mobile replacements
are delivered.

## Update model: start agent-managed, prepare for custom artifacts

### Agent-managed integration now

1. Fetch `upstream/main`.
2. Merge it into a clean checkout of the small fork branch.
3. Run focused checks for fork-owned surfaces (sideband and portfolio modules).
4. Build one versioned artifact per target platform.
5. Roll hosts one at a time, keeping a prior artifact available.
6. Record commit, artifact, host, result, and rollback location.

### Custom update channel later

After two or three stable fork releases, publish the same approved fork
artifacts to a custom update feed. The in-app update control then distributes
the custom artifact. It does not auto-resolve upstream merge conflicts; the
agent-managed integration step remains deliberate.

## Near-zero portfolio downtime

- Never update every host at once.
- Build once from an exact fork commit.
- Canary a non-critical host first.
- Roll one host at a time and keep the others serving native sideband dispatch.
- Retain one prior known-good artifact for rollback.
- A host restart may briefly interrupt that host, but portfolio coordination
  remains available through other T3 hosts and the sideband path.

## Portfolio extension boundary

First portfolio view/tab should reuse native T3 data rather than duplicate it:

- threads/turn state and approvals: native T3;
- portfolio task/card metadata: fork-owned extension data;
- project notes and trajectory: durable Markdown documents attached to the
  relevant project/workspace, linked from the portfolio view;
- heartbeats: explicit bounded schedules that dispatch normal native T3 turns;
- rants capture: inbox item or task draft, never a new always-on agent service.

Do not begin by building a second session registry, polling backend, or global
message bus.

## Work sequence

1. **Messaging now:** fix the sideband typecheck defects, push the fork branch,
   deploy compatible T3 builds to desktop/VPS, and prove cross-host receipts.
2. **Portfolio discovery:** one visible T3 planning agent maps existing
   VoiceTools portfolio/Heartbeat/task/trajectory work onto native T3 concepts
   and proposes one first Portfolio view/tab vertical slice.
3. **First vertical slice:** a Portfolio tab with project cards, linked notes,
   current task/handoff, and native thread state. No automatic Heartbeat yet.
4. **Release runner:** make the agent-managed upstream-merge/build/rolling-host
   sequence one documented command/runbook.
5. **Custom update feed:** only after repeated stable fork releases.

## Decisions deferred

- Exact portfolio extension storage schema.
- Whether project notes remain Markdown-only or gain a small T3-backed index.
- T3 mobile realtime/Plan-499 implementation; it follows the provenance map.
