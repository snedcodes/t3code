import {
  BotIcon,
  BookOpenCheckIcon,
  CheckSquare2Icon,
  FileTextIcon,
  FolderKanbanIcon,
  HeartPulseIcon,
  LightbulbIcon,
  MessageSquareQuoteIcon,
  OrbitIcon,
  ServerIcon,
  WrenchIcon,
} from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import { useMemo, useState } from "react";
import { useEnvironments } from "../state/environments";
import { useProjects, useThread, useThreadShells } from "../state/entities";
import { cn } from "../lib/utils";
import { DEFAULT_HUNG_TURN_THRESHOLD_MS } from "../portfolioTurnRecovery";
import { buildNativeHeartbeatTargets } from "../portfolioHeartbeatTargets";
import {
  classifyContextRotationHealth,
  CONTEXT_ROTATION_REQUIRED_TOKENS,
  CONTEXT_ROTATION_WATCH_TOKENS,
} from "../portfolioContextHealth";
import { deriveLatestContextWindowSnapshot, formatContextWindowTokens } from "../lib/contextWindow";
import { SidebarContent, SidebarGroup, useSidebar } from "./ui/sidebar";

export type PortfolioMode = "portfolio" | null;
export type PortfolioDestination =
  | "heartbeats"
  | "tasks"
  | "wishlist"
  | "agents"
  | "hosts"
  | "workflows"
  | "projects"
  | "documents"
  | "trajectory"
  | "rants";

type ModeSetter = Dispatch<SetStateAction<PortfolioMode>>;

const portfolioDestinations: ReadonlyArray<{
  id: PortfolioDestination;
  label: string;
  icon: typeof HeartPulseIcon;
  draft?: boolean;
}> = [
  { id: "heartbeats", label: "Heartbeats", icon: HeartPulseIcon },
  { id: "tasks", label: "Tasks", icon: CheckSquare2Icon },
  { id: "wishlist", label: "Wishlist", icon: LightbulbIcon },
  { id: "agents", label: "Agents", icon: BotIcon },
  { id: "hosts", label: "Host Health", icon: ServerIcon },
  { id: "workflows", label: "Help & Workflows", icon: BookOpenCheckIcon },
  { id: "projects", label: "Projects", icon: FolderKanbanIcon, draft: true },
  { id: "documents", label: "Documents", icon: FileTextIcon, draft: true },
  { id: "trajectory", label: "Trajectory", icon: OrbitIcon, draft: true },
  { id: "rants", label: "Rants", icon: MessageSquareQuoteIcon, draft: true },
];

export function PortfolioModeSidebar({
  mode,
  setMode,
  destination,
  setDestination,
}: {
  mode: Exclude<PortfolioMode, null>;
  setMode: ModeSetter;
  destination: PortfolioDestination;
  setDestination: (destination: PortfolioDestination) => void;
}) {
  return (
    <>
      <div className="border-b border-sidebar-border px-4 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-300">
          Portfolio Control
        </p>
        <h2 className="mt-1 text-sm font-semibold text-sidebar-foreground">Portfolio views</h2>
        <button
          type="button"
          className="mt-2 text-xs text-sidebar-muted-foreground underline-offset-2 hover:text-sidebar-foreground hover:underline"
          onClick={() => setMode(null)}
        >
          Back to projects and threads
        </button>
      </div>
      <PortfolioDestinationList destination={destination} setDestination={setDestination} />
    </>
  );
}

function PortfolioDestinationList({
  destination,
  setDestination,
}: {
  destination: PortfolioDestination;
  setDestination: (destination: PortfolioDestination) => void;
}) {
  const { isMobile, setOpenMobile } = useSidebar();

  return (
    <SidebarContent className="gap-0">
      <SidebarGroup className="gap-1 p-3">
        <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-muted-foreground">
          Portfolio Control
        </p>
        {portfolioDestinations.map(({ id, label, icon: Icon, draft }) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setDestination(id);
              if (isMobile) setOpenMobile(false);
            }}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors",
              destination === id
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-muted-foreground hover:bg-sidebar-row-hover hover:text-sidebar-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{label}</span>
            {draft ? (
              <span className="text-[10px] uppercase tracking-wide opacity-60">Draft</span>
            ) : null}
          </button>
        ))}
      </SidebarGroup>
    </SidebarContent>
  );
}

export function PortfolioModeView({
  destination,
  setMode,
}: {
  destination: PortfolioDestination;
  setMode: ModeSetter;
}) {
  const { environments } = useEnvironments();
  const projects = useProjects();
  const threads = useThreadShells();
  const heartbeatTargets = useMemo(
    () => buildNativeHeartbeatTargets(projects, threads),
    [projects, threads],
  );
  const [selectedHeartbeatTargetKey, setSelectedHeartbeatTargetKey] = useState<string | null>(null);
  const selectedHeartbeatTarget =
    heartbeatTargets.find((target) => target.key === selectedHeartbeatTargetKey) ??
    heartbeatTargets[0] ??
    null;
  const selectedThread = useThread(
    destination === "heartbeats" && selectedHeartbeatTarget
      ? {
          environmentId: selectedHeartbeatTarget.environmentId,
          threadId: selectedHeartbeatTarget.threadId,
        }
      : null,
  );
  const selectedContextUsage = useMemo(
    () => deriveLatestContextWindowSnapshot(selectedThread?.activities ?? []),
    [selectedThread?.activities],
  );
  const titles: Record<PortfolioDestination, { title: string; description: string }> = {
    heartbeats: {
      title: "Heartbeats",
      description:
        "Native Heartbeat entry point. The upcoming VoiceTools port is not connected yet.",
    },
    tasks: {
      title: "Tasks",
      description: "VoiceTools task records are not connected to this native T3 view yet.",
    },
    wishlist: {
      title: "Wishlist",
      description: "VoiceTools Wishlist records are not connected to this native T3 view yet.",
    },
    agents: {
      title: "Agents",
      description: "Use the normal T3 project and thread inbox for native agent sessions.",
    },
    hosts: {
      title: "Host Health",
      description:
        "Native environment context is available; VoiceTools diagnostics are not connected.",
    },
    workflows: {
      title: "Help & Workflows",
      description:
        "A read-only index of the routines agents and the Portfolio Overseer use to keep work moving.",
    },
    projects: {
      title: "Projects",
      description: "Draft destination. Project portfolio data will be connected later.",
    },
    documents: {
      title: "Documents",
      description: "Draft destination. VoiceTools document readback is not connected.",
    },
    trajectory: {
      title: "Trajectory",
      description: "Draft destination. Authoritative trajectory data is not connected.",
    },
    rants: {
      title: "Rants",
      description: "Draft destination. Rant capture is not connected.",
    },
  };
  const view = titles[destination];

  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-background text-foreground">
      <div className="mx-auto w-full max-w-4xl p-6 sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-300">
          Portfolio Control
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{view.title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {view.description}
        </p>
        {destination === "heartbeats" ? (
          <section className="mt-8 rounded-xl border border-sky-400/20 bg-sky-400/5 p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-medium">Native Heartbeat foundation</h2>
              <span className="rounded-full border border-sky-400/30 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-sky-300">
                Paused
              </span>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Select a real native T3 thread as a future target. Scheduling, persistence, polling,
              and dispatch are not enabled, so every target remains paused.
            </p>
            <div className="mt-5 grid gap-2" aria-label="Native Heartbeat targets">
              {heartbeatTargets.length === 0 ? (
                <p className="rounded-lg border border-border/60 bg-background/30 p-3 text-sm text-muted-foreground">
                  No native T3 threads are available yet.
                </p>
              ) : (
                heartbeatTargets.slice(0, 20).map((target) => {
                  const isSelected = selectedHeartbeatTarget?.key === target.key;
                  return (
                    <button
                      key={target.key}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => setSelectedHeartbeatTargetKey(target.key)}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-left transition-colors",
                        isSelected
                          ? "border-sky-400/50 bg-sky-400/10"
                          : "border-border/60 bg-background/20 hover:bg-background/40",
                      )}
                    >
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <span className="min-w-0 flex-1 truncate">{target.threadTitle}</span>
                        <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                          Paused
                        </span>
                      </span>
                      <span className="mt-1 block truncate text-xs text-muted-foreground">
                        {target.projectTitle} · {target.environmentId}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
            {heartbeatTargets.length > 20 ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Showing the 20 most relevant native threads. The full project/thread inbox remains
                available from Agents.
              </p>
            ) : null}
            {selectedHeartbeatTarget ? (
              <div className="mt-5 border-t border-sky-400/15 pt-4 text-xs text-muted-foreground">
                <p>
                  Selected target:{" "}
                  <span className="font-medium text-foreground">
                    {selectedHeartbeatTarget.threadTitle}
                  </span>
                </p>
                <p className="mt-1">
                  Native thread: {selectedHeartbeatTarget.threadId} · current session:{" "}
                  {selectedHeartbeatTarget.sessionStatus ?? "not started"}
                </p>
                <p className="mt-2">
                  VoiceTools Heartbeat ownership and receipts will be connected in a later port.
                </p>
              </div>
            ) : null}
            <ContextRotationCard usage={selectedContextUsage} />
          </section>
        ) : null}
        {destination === "wishlist" ? <WishlistPreview /> : null}
        {destination === "hosts" ? (
          <section className="mt-8 rounded-xl border border-border/70 bg-card/30 p-5">
            <h2 className="font-medium">Native environments</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {environments.length} connected native environment
              {environments.length === 1 ? "" : "s"}. VoiceTools host health is unavailable here.
            </p>
          </section>
        ) : null}
        {destination === "agents" ? (
          <section className="mt-8 rounded-xl border border-border/70 bg-card/30 p-5">
            <h2 className="font-medium">Open native Agents</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Use the native project/session list for direct thread links.
            </p>
            <button
              type="button"
              className="mt-4 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted/50"
              onClick={() => setMode(null)}
            >
              Show Agents list
            </button>
          </section>
        ) : null}
        {destination === "workflows" ? <WorkflowCatalog /> : null}
      </div>
    </main>
  );
}

function ContextRotationCard({
  usage,
}: {
  usage: ReturnType<typeof deriveLatestContextWindowSnapshot>;
}) {
  const health = classifyContextRotationHealth(usage?.totalProcessedTokens);
  const healthLabel = {
    unavailable: "No telemetry",
    normal: "Below watch level",
    watch: "Rotation watch",
    "rotation-required": "Rotation required",
  }[health];
  const healthClassName = {
    unavailable: "border-border text-muted-foreground",
    normal: "border-emerald-400/30 text-emerald-300",
    watch: "border-amber-400/30 text-amber-300",
    "rotation-required": "border-rose-400/30 text-rose-300",
  }[health];

  return (
    <div className="mt-5 border-t border-sky-400/15 pt-4" aria-label="Context and rotation health">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium">Context and rotation health</h3>
        <span
          className={cn(
            "rounded-full border px-2 py-1 text-[10px] font-medium uppercase tracking-wide",
            healthClassName,
          )}
        >
          {healthLabel}
        </span>
      </div>
      {usage ? (
        <>
          <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
            <p>
              Context used:{" "}
              <span className="font-medium text-foreground">
                {formatContextWindowTokens(usage.usedTokens)}
              </span>
              {usage.maxTokens ? ` / ${formatContextWindowTokens(usage.maxTokens)}` : ""}
            </p>
            <p>
              Total processed:{" "}
              <span className="font-medium text-foreground">
                {formatContextWindowTokens(usage.totalProcessedTokens ?? null)}
              </span>
            </p>
            <p>
              Updated:{" "}
              <span className="font-medium text-foreground">
                {new Date(usage.updatedAt).toLocaleString()}
              </span>
            </p>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Watch at {formatContextWindowTokens(CONTEXT_ROTATION_WATCH_TOKENS)} processed tokens;
            rotation is required at {formatContextWindowTokens(CONTEXT_ROTATION_REQUIRED_TOKENS)}.
          </p>
        </>
      ) : (
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          This native thread has not reported context-token telemetry yet. T3 will not estimate
          usage from transcript text.
        </p>
      )}
    </div>
  );
}

function WorkflowCatalog() {
  const workflows = [
    {
      title: "Git and workspace lifecycle",
      summary: "Choose the correct development, runtime, or build workspace before editing.",
      source: "agents-dev-guidelines Plan 016",
    },
    {
      title: "Skills and routine operating rules",
      summary: "Use a repeatable skill for recurring work instead of relying on chat memory.",
      source: "agents-dev-guidelines Plan 016",
    },
    {
      title: "Agent rotation and handoff",
      summary: "Prepare a durable handoff, validate intake, and preserve one active occupant.",
      source: "Plans 006 and 007",
    },
    {
      title: "Maintenance, cleanup, and repair",
      summary: "Run small, evidence-backed maintenance actions and record the result.",
      source: "Agent-operable workflow standards",
    },
    {
      title: "Disk footprint and session storage",
      summary:
        "Review Codex rollouts, T3 projections, caches, databases, and generated artifacts before cleanup.",
      source: "Portfolio storage hygiene; read-only until cleanup is explicit",
    },
    {
      title: "Stop a stale turn",
      summary:
        "Manually interrupt the current native T3 turn before diagnosing or resending a message.",
      source: "Native T3 provider interrupt path",
    },
    {
      title: "Automatic hung-turn recovery",
      summary:
        "Optional per-thread Auto Resend watches for a genuinely stale text-only turn. Native tool activity, approval, or input keeps it in warning/review mode instead of stopping or resending.",
      source: "Native T3 Auto Resend setting; no polling",
    },
    {
      title: "Context and rotation health",
      summary: "Watch native processed-token thresholds: 150m watch, 200m rotation required.",
      source: "VoiceTools Plan 563",
    },
  ] as const;

  return (
    <>
      <section
        className="mt-8 rounded-xl border border-border/70 bg-card/30 p-5"
        aria-label="Turn recovery policy"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-300">
              Native T3 policy
            </p>
            <h2 className="mt-1 font-medium">Hung-turn recovery</h2>
          </div>
          <span className="rounded-full border border-border px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Per-thread setting
          </span>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          When Auto Resend is enabled for a thread, a running turn may be considered stale after{" "}
          {DEFAULT_HUNG_TURN_THRESHOLD_MS / 60_000} minutes without newer native progress. A
          text-only turn with no tool activity can use the existing native Stop path and resend the
          unchanged prompt. Tool activity, approval, or user-input activity produces a warning for
          review instead.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-[11px] uppercase tracking-wide text-muted-foreground/80">
          <span className="rounded-full border border-border px-2 py-1">No polling</span>
          <span className="rounded-full border border-border px-2 py-1">
            Tool activity → review
          </span>
          <span className="rounded-full border border-border px-2 py-1">Native Stop path</span>
        </div>
      </section>
      <section className="mt-3 grid gap-3 sm:grid-cols-2" aria-label="Available workflows">
        {workflows.map((workflow) => (
          <article
            key={workflow.title}
            className="rounded-xl border border-border/70 bg-card/30 p-4"
          >
            <div className="flex items-start gap-3">
              <WrenchIcon className="mt-0.5 size-4 shrink-0 text-sky-500 dark:text-sky-300" />
              <div className="min-w-0">
                <h2 className="font-medium">{workflow.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {workflow.summary}
                </p>
                <p className="mt-3 text-[11px] uppercase tracking-wide text-muted-foreground/70">
                  {workflow.source}
                </p>
              </div>
            </div>
          </article>
        ))}
      </section>
    </>
  );
}

function WishlistPreview() {
  return (
    <section className="mt-8 rounded-xl border border-amber-400/20 bg-amber-400/5 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-300">
            Wishlist candidate
          </p>
          <h2 className="mt-1 font-medium">Automatic hung-turn recovery</h2>
        </div>
        <span className="rounded-full border border-amber-400/30 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-amber-300">
          Proposed
        </span>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        If a user-sent T3 turn stays in Working or Pending without meaningful progress for roughly
        2–3 minutes, T3 should detect the stalled turn, use its native Stop action, and offer or
        perform one safe resend of the unchanged prompt.
      </p>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground/80">
        This is only recorded for planning. It is not active, does not poll, and does not resend
        messages. The eventual workflow must preserve the original prompt, use the exact turn
        identity, avoid duplicate sends when delivery is uncertain, and leave a stop/resend receipt.
      </p>
    </section>
  );
}

export function PortfolioModeTopBar({
  mode,
  setMode,
}: {
  mode: PortfolioMode;
  setMode: ModeSetter;
}) {
  const { isMobile, setOpenMobile } = useSidebar();

  return (
    <div className="pointer-events-none fixed left-[var(--workspace-titlebar-content-left)] top-0 z-40 flex h-[var(--workspace-topbar-height)] items-center gap-1 md:left-[calc(var(--workspace-titlebar-content-left)+4rem)]">
      {(["agents", "portfolio"] as const).map((nextMode) => {
        const isActive = nextMode === "agents" ? mode === null : mode === "portfolio";
        const nextValue =
          nextMode === "agents" ? null : mode === "portfolio" ? null : ("portfolio" as const);
        return (
          <button
            key={nextMode}
            type="button"
            className={cn(
              "pointer-events-auto rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors [-webkit-app-region:no-drag]",
              isActive
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
            )}
            aria-pressed={isActive}
            onClick={() => {
              setMode(nextValue);
              if (isMobile && nextValue !== null) setOpenMobile(true);
            }}
          >
            {nextMode === "agents" ? "Agents" : "Portfolio"}
          </button>
        );
      })}
    </div>
  );
}
