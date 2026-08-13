import { createFileRoute, redirect } from "@tanstack/react-router";
import {
  BotIcon,
  CheckSquare2Icon,
  ChevronDownIcon,
  CircleDashedIcon,
  FileTextIcon,
  FolderKanbanIcon,
  HeartPulseIcon,
  LightbulbIcon,
  MessageSquareQuoteIcon,
  OrbitIcon,
  PlusIcon,
  ServerIcon,
  SparklesIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";

import { SidebarInset } from "../components/ui/sidebar";
import { useProjects, useThreadShells } from "../state/entities";
import { cn } from "../lib/utils";

type Destination =
  | "tasks"
  | "wishlist"
  | "agents"
  | "heartbeats"
  | "hosts"
  | "projects"
  | "documents"
  | "trajectory"
  | "rants";

const destinations: ReadonlyArray<{
  id: Destination;
  label: string;
  icon: typeof BotIcon;
  group: string;
  draft?: boolean;
}> = [
  { id: "tasks", label: "Tasks", icon: CheckSquare2Icon, group: "Work" },
  { id: "wishlist", label: "Wishlist", icon: LightbulbIcon, group: "Work" },
  { id: "agents", label: "Agents", icon: BotIcon, group: "Operations" },
  { id: "heartbeats", label: "Heartbeats", icon: HeartPulseIcon, group: "Operations" },
  { id: "hosts", label: "Host Health", icon: ServerIcon, group: "Operations" },
  { id: "projects", label: "Projects", icon: FolderKanbanIcon, group: "Plan 544", draft: true },
  { id: "documents", label: "Documents", icon: FileTextIcon, group: "Plan 544", draft: true },
  { id: "trajectory", label: "Trajectory", icon: OrbitIcon, group: "Plan 544", draft: true },
  { id: "rants", label: "Rants", icon: MessageSquareQuoteIcon, group: "Plan 544", draft: true },
];

function StatusChip({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "draft" | "connected" | "paused";
}) {
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em]",
        tone === "draft" && "border-amber-400/30 bg-amber-400/10 text-amber-300",
        tone === "connected" && "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
        tone === "paused" && "border-sky-400/30 bg-sky-400/10 text-sky-300",
        tone === "neutral" && "border-border bg-muted/40 text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

function NativeAgents() {
  const projects = useProjects();
  const threads = useThreadShells();
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const groups = useMemo(
    () =>
      projects.map((project) => ({
        project,
        threads: threads.filter((thread) => thread.projectId === project.id),
      })),
    [projects, threads],
  );
  const toggle = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-sky-400/20 bg-sky-400/5 p-4 text-sm text-muted-foreground">
        <span className="font-medium text-sky-200">Native T3 state</span> · Agents are read from
        connected project/thread shells. Passport, Heartbeat, and task relationships remain
        unavailable until the VoiceTools owner seam is connected.
      </div>
      {groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No connected T3 projects yet.
        </div>
      ) : (
        groups.map(({ project, threads: projectThreads }) => {
          const isOpen = expanded.has(project.id) || groups.length === 1;
          return (
            <div
              key={project.id}
              className="overflow-hidden rounded-xl border border-border/70 bg-card/30"
            >
              <button
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/30"
                onClick={() => toggle(project.id)}
              >
                <ChevronDownIcon
                  className={cn(
                    "size-4 text-muted-foreground transition-transform",
                    isOpen && "rotate-180",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{project.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{project.workspaceRoot}</p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {projectThreads.length} session{projectThreads.length === 1 ? "" : "s"}
                </span>
              </button>
              {isOpen && (
                <div className="border-t border-border/60 p-3">
                  {projectThreads.length === 0 ? (
                    <p className="px-2 py-2 text-xs text-muted-foreground">
                      No T3 sessions in this project.
                    </p>
                  ) : (
                    <div className="grid gap-2 md:grid-cols-2">
                      {projectThreads.map((thread) => (
                        <article
                          key={`${thread.environmentId}:${thread.id}`}
                          className="rounded-lg border border-border/60 bg-background/40 p-3"
                        >
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 rounded-md bg-violet-400/10 p-1.5 text-violet-300">
                              <BotIcon className="size-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <h4 className="truncate text-sm font-medium">{thread.title}</h4>
                                <StatusChip
                                  tone={
                                    thread.session?.status === "running" ? "connected" : "neutral"
                                  }
                                >
                                  {thread.session?.status ?? "offline"}
                                </StatusChip>
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {thread.modelSelection.model ?? "Model unavailable"} ·{" "}
                                {thread.environmentId}
                              </p>
                              <p className="mt-2 text-[11px] text-muted-foreground">
                                Passport: connected-later
                              </p>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

function ConnectedLater({
  title,
  description,
  icon: Icon = CircleDashedIcon,
}: {
  title: string;
  description: string;
  icon?: typeof CircleDashedIcon;
}) {
  return (
    <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-dashed border-border/80 bg-card/20 p-8">
      <div className="max-w-md text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl border border-border bg-muted/30 text-muted-foreground">
          <Icon className="size-5" />
        </div>
        <div className="mt-5 flex items-center justify-center gap-2">
          <h3 className="text-lg font-semibold">{title}</h3>
          <StatusChip tone="draft">Connected later</StatusChip>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
        <p className="mt-4 text-xs text-muted-foreground/70">
          This draft does not create records, call VoiceTools, or activate runtime controls.
        </p>
      </div>
    </div>
  );
}

function DraftDestination({ destination }: { destination: Destination }) {
  const copy: Record<string, [string, string]> = {
    projects: [
      "Projects",
      "Project workspaces and ownership will connect after the Plan 544 project registry exists.",
    ],
    documents: [
      "Documents",
      "Allowlisted Markdown discovery and readback remain a future connected surface.",
    ],
    trajectory: [
      "Trajectory",
      "High-level trajectory browsing and proposal review are planned, but Git remains authoritative.",
    ],
    rants: [
      "Rants",
      "Raw intent capture and proposal-based distillation are planned; no rant storage is assumed here.",
    ],
  };
  const [title, description] = copy[destination] ?? [
    "Draft",
    "This destination is not connected yet.",
  ];
  return (
    <ConnectedLater
      title={title}
      description={description}
      icon={
        destination === "documents"
          ? FileTextIcon
          : destination === "rants"
            ? MessageSquareQuoteIcon
            : destination === "trajectory"
              ? OrbitIcon
              : FolderKanbanIcon
      }
    />
  );
}

function PortfolioControl() {
  const [active, setActive] = useState<Destination>("tasks");
  const projects = useProjects();
  const threads = useThreadShells();
  const groups = [...new Set(destinations.map((destination) => destination.group))];
  const destination = destinations.find((item) => item.id === active)!;
  const content =
    active === "agents" ? (
      <NativeAgents />
    ) : active === "tasks" ? (
      <ConnectedLater
        title="Tasks"
        description="The native T3 shell is ready for this workspace, but Task identity, checklists, owners, plans, and revisions remain authoritative in VoiceTools Plan 543/561."
        icon={CheckSquare2Icon}
      />
    ) : active === "wishlist" ? (
      <ConnectedLater
        title="Wishlist"
        description="Wishlist capture and promotion need the VoiceTools task contract. This surface intentionally does not create a second database."
        icon={LightbulbIcon}
      />
    ) : active === "heartbeats" ? (
      <ConnectedLater
        title="Heartbeats"
        description="Heartbeat state is owned by VoiceTools Plan 561 and remains globally paused during diagnosis. No activation or polling is available here."
        icon={HeartPulseIcon}
      />
    ) : active === "hosts" ? (
      <ConnectedLater
        title="Host Health"
        description="Host capability and freshness will connect to an explicit owner-aware diagnostic read. Process liveness is not inferred from native T3 thread state."
        icon={ServerIcon}
      />
    ) : (
      <DraftDestination destination={active} />
    );

  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden bg-background text-foreground">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="hidden w-60 shrink-0 flex-col border-r border-border/70 bg-card/15 p-4 lg:flex">
          <div className="mb-8 px-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-300">
              T3 workspace
            </p>
            <h1 className="mt-2 text-lg font-semibold tracking-tight">Portfolio Control</h1>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              A native draft for visible work and truthful connections.
            </p>
          </div>
          <nav className="space-y-5" aria-label="Portfolio destinations">
            {groups.map((group) => (
              <div key={group}>
                <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {group}
                </p>
                <div className="space-y-1">
                  {destinations
                    .filter((item) => item.group === group)
                    .map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.id}
                          onClick={() => setActive(item.id)}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                            active === item.id
                              ? "bg-violet-400/12 text-violet-200"
                              : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                          )}
                        >
                          <Icon className="size-4" />
                          <span className="flex-1">{item.label}</span>
                          {item.draft && <StatusChip tone="draft">Draft</StatusChip>}
                        </button>
                      );
                    })}
                </div>
              </div>
            ))}
          </nav>
          <div className="mt-auto rounded-xl border border-border/60 bg-background/30 p-3 text-[11px] leading-relaxed text-muted-foreground">
            No VoiceTools proxy. No task database. No polling. Heartbeats stay paused.
          </div>
        </aside>
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl p-5 sm:p-8">
            <header className="mb-8 flex flex-col gap-5 border-b border-border/60 pb-6 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <SparklesIcon className="size-4 text-violet-300" />
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-300">
                    Draft native surface
                  </p>
                </div>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
                  {destination.label}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  Tasks, wishlist, visible agents, and operational destinations in one honest
                  workspace.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusChip tone="connected">T3 connected</StatusChip>
                <StatusChip>VoiceTools connected later</StatusChip>
                <button
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-muted-foreground"
                  disabled
                >
                  <PlusIcon className="size-3.5" /> New record{" "}
                  <span className="sr-only">(connected later)</span>
                </button>
              </div>
            </header>
            <div className="mb-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border/60 bg-card/30 p-4">
                <p className="text-xs text-muted-foreground">Native T3 projects</p>
                <p className="mt-1 text-2xl font-semibold">{projects.length}</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-card/30 p-4">
                <p className="text-xs text-muted-foreground">Visible sessions</p>
                <p className="mt-1 text-2xl font-semibold">{threads.length}</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-card/30 p-4">
                <p className="text-xs text-muted-foreground">Runtime controls</p>
                <p className="mt-1 text-2xl font-semibold text-sky-300">Paused</p>
              </div>
            </div>
            {content}
          </div>
        </main>
      </div>
    </SidebarInset>
  );
}

export const Route = createFileRoute("/portfolio-control")({
  beforeLoad: async ({ context }) => {
    if (
      context.authGateState.status !== "authenticated" &&
      context.authGateState.status !== "hosted-static"
    ) {
      throw redirect({ to: "/pair", replace: true });
    }
  },
  component: PortfolioControl,
});
