export type PortfolioWorkflow = {
  readonly id: string;
  readonly title: string;
  readonly purpose: string;
  readonly whenToUse: string;
  readonly inputs: ReadonlyArray<string>;
  readonly permittedActions: ReadonlyArray<string>;
  readonly stopConditions: ReadonlyArray<string>;
  readonly evidence: ReadonlyArray<string>;
  readonly source: string;
};

export const PORTFOLIO_WORKFLOWS: ReadonlyArray<PortfolioWorkflow> = [
  {
    id: "git-workspace-lifecycle",
    title: "Git and workspace lifecycle",
    purpose: "Keep edits in the correct repository and preserve unrelated work.",
    whenToUse: "Before editing source, changing branches, or handing work to another agent.",
    inputs: ["Repository path", "Current branch and dirty-state summary", "Owned file scope"],
    permittedActions: [
      "Read current instructions",
      "Edit owned files",
      "Run focused checks",
      "Commit owned changes",
    ],
    stopConditions: [
      "Target path is unclear",
      "Unrelated dirty files overlap the requested change",
    ],
    evidence: ["Changed-file list", "Focused validation result", "Commit hash"],
    source: "docs/portfolio-control-expansion-plan-2026-08-16.md",
  },
  {
    id: "skills-and-operating-rules",
    title: "Skills and routine operating rules",
    purpose: "Use the relevant repeatable workflow instead of relying on chat memory.",
    whenToUse: "Whenever a task matches an available repository or product skill.",
    inputs: ["Task type", "Available skill instructions", "Repository rules"],
    permittedActions: ["Read the selected skill", "Follow its required checks", "Report evidence"],
    stopConditions: ["Required skill is unavailable", "Skill conflicts with the user request"],
    evidence: ["Skill used", "Files or checks affected", "Remaining limitation"],
    source: "AGENTS.md and agents-dev-guidelines Plan 016",
  },
  {
    id: "agent-rotation-handoff",
    title: "Agent rotation and handoff",
    purpose: "Move work to a fresh agent without losing the current state or ownership.",
    whenToUse: "Before context becomes difficult to manage or a lane changes owner.",
    inputs: ["Current task and finish line", "Commits and dirty files", "Known blockers"],
    permittedActions: [
      "Write a concise handoff",
      "Verify the receiving thread",
      "Record the receipt",
    ],
    stopConditions: [
      "Receiving session identity is ambiguous",
      "Uncommitted work is not understood",
    ],
    evidence: ["Visible T3 title and project", "Readback freshness", "Handoff receipt"],
    source: "agents-dev-guidelines Plans 006 and 007",
  },
  {
    id: "maintenance-cleanup-repair",
    title: "Maintenance, cleanup, and repair",
    purpose: "Make small, evidence-backed repairs while keeping live state safe.",
    whenToUse: "When an agent, service, repository, or local workflow needs maintenance.",
    inputs: ["Observed failure", "Affected owner", "Recovery path", "Rollback point"],
    permittedActions: [
      "Inspect first",
      "Apply a bounded repair",
      "Run a focused check",
      "Record the result",
    ],
    stopConditions: ["Repair would delete data", "External runtime or credentials are required"],
    evidence: ["Before/after state", "Validation output", "Files or runtime touched"],
    source: "Agent-operable workflow standards",
  },
  {
    id: "disk-footprint-session-storage",
    title: "Disk footprint and session storage",
    purpose: "Find which bounded storage categories are growing before cleanup is considered.",
    whenToUse:
      "When T3, Codex sessions, attachments, caches, or build artifacts grow unexpectedly.",
    inputs: ["Owned host", "Bounded category roots", "Age and active-process context"],
    permittedActions: [
      "Measure and classify",
      "Show inaccessible paths honestly",
      "Prepare a dry-run proposal",
    ],
    stopConditions: [
      "Path is outside the owned host",
      "Live database deletion or repair is proposed",
    ],
    evidence: [
      "Path, category, bytes, age",
      "Active/inactive/unknown state",
      "Read-only inventory receipt",
    ],
    source: "docs/portfolio-control-expansion-plan-2026-08-16.md; VoiceTools Plan 568",
  },
  {
    id: "stop-stale-native-turn",
    title: "Stop a stale native T3 turn",
    purpose: "Stop a turn that is genuinely stalled using T3’s existing native interrupt path.",
    whenToUse: "When a running turn has no newer native progress and the operator needs control.",
    inputs: ["Exact environment and thread", "Active turn identity", "Latest native activity"],
    permittedActions: [
      "Inspect current activity",
      "Use the native Stop action",
      "Wait for the stopped receipt",
    ],
    stopConditions: [
      "Tool or approval activity is still progressing",
      "Turn identity is uncertain",
    ],
    evidence: ["Native interrupt result", "Stopped/cancelled receipt", "Decision about resend"],
    source:
      "Native T3 provider interrupt path; docs/portfolio-control-expansion-plan-2026-08-16.md",
  },
  {
    id: "context-rotation-health",
    title: "Context-token and rotation health",
    purpose: "Use native context telemetry to decide when a session needs rotation.",
    whenToUse: "When reviewing a long-running session or preparing an agent handoff.",
    inputs: ["Native context-window.updated activity", "Total processed tokens", "Current thread"],
    permittedActions: [
      "Read the latest native telemetry",
      "Mark watch or rotation required",
      "Prepare a handoff",
    ],
    stopConditions: ["Telemetry is unavailable", "Transcript estimation would be required"],
    evidence: ["Context used", "Total processed", "Telemetry timestamp", "Rotation state"],
    source: "VoiceTools Plan 563; apps/web/src/lib/contextWindow.ts",
  },
  {
    id: "auto-resend-review",
    title: "Automatic hung-turn recovery",
    purpose: "Optionally recover only a genuinely stale text-only turn without tool activity.",
    whenToUse: "When Auto Resend is enabled for this thread and native progress has stopped.",
    inputs: [
      "Per-thread Auto Resend setting",
      "Active turn",
      "Latest native activity",
      "Tool activity state",
    ],
    permittedActions: ["Observe", "Warn for review", "Native stop then resend only when safe"],
    stopConditions: ["Any tool, approval, input, or image activity", "Turn is not genuinely stale"],
    evidence: ["Assessment state", "Interrupt result if used", "Resend or review notification"],
    source: "apps/web/src/portfolioTurnRecovery.ts and ChatView.tsx",
  },
];
