# Mandatory build workspace closeout

User-authorized standing rule, 6 October 2026. Applies to build, packaging,
verification and temporary integration work across repositories.

- Before creating a disposable workspace, record its exact absolute path,
  owning job, source commit and closeout condition in the existing job receipt.
  Reuse a named warm builder instead of creating another dated dependency tree.
- After success, failure or abandonment, close out that job in the same work
  tranche. Preserve meaningful source in Git, verified artifacts outside the
  disposable folder and a small receipt; then retire its disposable workspace,
  staging trees, copied test profiles and intermediate outputs. Cleanup is part
  of completion, not an optional future task.
- The user's standing authority covers an explicitly recorded, agent-owned
  disposable target after these checks. Resolve the final path, keep it within
  its declared managed root, verify no runtime references it, and preserve
  modified or untracked source before removal. This is not permission to delete
  arbitrary old folders by name, age or size.
- Retain at most one explicitly named warm builder per product/platform on its
  authorized build host, plus the current artifact and one useful fallback.
  Additional retention needs a concrete reason and expiry/removal condition.
  “Keep for recovery” alone is insufficient. Failed investigations may retain
  one bounded debug workspace; superseded attempts must be retired.
- Treat copied test databases as disposable fixtures, never as the user's live
  database. Do not clone a full profile merely to prove that a bundle starts.
  When realistic data is necessary, record that copy and retire it after use.
- Put closeout in each owned runner's finalization path where practical.
  Before reporting completion, inspect the remaining paths and report cleanup
  status, bytes recovered and any named retained exception. A successful build
  with unexplained leftovers is not complete.
- Preserve live owners, installed apps, user data, source checkouts, canonical
  credentials and shared Gradle/pnpm/toolchain caches. Do not stop processes by
  pattern, reset source, add a sweeping janitor, or wipe shared caches as routine
  cleanup. Existing repository-specific runtime and release rules still apply.

