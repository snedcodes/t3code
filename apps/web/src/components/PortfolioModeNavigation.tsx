import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import {
  BotIcon,
  CheckSquare2Icon,
  FileTextIcon,
  FolderKanbanIcon,
  HeartPulseIcon,
  LightbulbIcon,
  MessageSquareQuoteIcon,
  OrbitIcon,
  ServerIcon,
} from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import { Link, useLocation } from "@tanstack/react-router";

import { buildThreadRouteParams } from "../threadRoutes";
import { useProjects, useThreadShells } from "../state/entities";
import { useEnvironments } from "../state/environments";
import { cn } from "../lib/utils";
import { SidebarContent, SidebarGroup, useSidebar } from "./ui/sidebar";

export type PortfolioMode = "agents" | "portfolio" | null;
export type PortfolioDestination =
  | "heartbeats"
  | "tasks"
  | "wishlist"
  | "agents"
  | "hosts"
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
          {mode === "agents" ? "Native T3" : "Portfolio Control"}
        </p>
        <h2 className="mt-1 text-sm font-semibold text-sidebar-foreground">
          {mode === "agents" ? "Agents and sessions" : "Portfolio views"}
        </h2>
        <button
          type="button"
          className="mt-2 text-xs text-sidebar-muted-foreground underline-offset-2 hover:text-sidebar-foreground hover:underline"
          onClick={() => setMode(null)}
        >
          Back to projects and threads
        </button>
      </div>
      {mode === "agents" ? <NativeAgentList setMode={setMode} /> : null}
      {mode === "portfolio" ? (
        <PortfolioDestinationList destination={destination} setDestination={setDestination} />
      ) : null}
    </>
  );
}

function NativeAgentList({ setMode }: { setMode: ModeSetter }) {
  const projects = useProjects();
  const threads = useThreadShells();
  const pathname = useLocation({ select: (location) => location.pathname });
  const { isMobile, setOpenMobile } = useSidebar();
  const projectGroups = projects.map((project) => ({
    project,
    threads: threads.filter(
      (thread) => thread.environmentId === project.environmentId && thread.projectId === project.id,
    ),
  }));

  return (
    <SidebarContent className="gap-0">
      <SidebarGroup className="gap-2 p-3">
        {projectGroups.length === 0 ? (
          <p className="px-2 py-4 text-xs leading-relaxed text-sidebar-muted-foreground">
            No native T3 projects are connected yet.
          </p>
        ) : (
          projectGroups.map(({ project, threads: projectThreads }) => (
            <div key={`${project.environmentId}:${project.id}`} className="space-y-1">
              <p className="truncate px-2 py-1 text-[11px] font-semibold text-sidebar-muted-foreground">
                {project.title}
              </p>
              {projectThreads.length === 0 ? (
                <p className="px-2 py-1 text-xs text-sidebar-muted-foreground">No sessions</p>
              ) : (
                projectThreads.map((thread) => {
                  const path = `/${thread.environmentId}/${thread.id}`;
                  const isActive = pathname === path;
                  return (
                    <Link
                      key={`${thread.environmentId}:${thread.id}`}
                      to="/$environmentId/$threadId"
                      params={buildThreadRouteParams(
                        scopeThreadRef(thread.environmentId, thread.id),
                      )}
                      onClick={() => {
                        setMode("agents");
                        if (isMobile) setOpenMobile(false);
                      }}
                      className={cn(
                        "block rounded-md px-2 py-2 text-xs outline-hidden transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-muted-foreground hover:bg-sidebar-row-hover hover:text-sidebar-foreground",
                      )}
                    >
                      <span className="block truncate font-medium">{thread.title}</span>
                      <span className="mt-0.5 block truncate text-[11px] opacity-70">
                        {thread.session?.status ?? "offline"} · {thread.environmentId}
                      </span>
                    </Link>
                  );
                })
              )}
            </div>
          ))
        )}
      </SidebarGroup>
    </SidebarContent>
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
      description: "Native projects and sessions are available from the Agents mode.",
    },
    hosts: {
      title: "Host Health",
      description:
        "Native environment context is available; VoiceTools diagnostics are not connected.",
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
              Heartbeat scheduling, persistence, polling, and dispatch are not enabled.
            </p>
          </section>
        ) : null}
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
              onClick={() => setMode("agents")}
            >
              Show Agents list
            </button>
          </section>
        ) : null}
      </div>
    </main>
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
      {(["agents", "portfolio"] as const).map((nextMode) => (
        <button
          key={nextMode}
          type="button"
          className={cn(
            "pointer-events-auto rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors [-webkit-app-region:no-drag]",
            mode === nextMode
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
          )}
          aria-pressed={mode === nextMode}
          onClick={() => {
            const nextValue = mode === nextMode ? null : nextMode;
            setMode(nextValue);
            if (isMobile && nextValue !== null) setOpenMobile(true);
          }}
        >
          {nextMode === "agents" ? "Agents" : "Portfolio"}
        </button>
      ))}
    </div>
  );
}
