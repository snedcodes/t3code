import {
  BotIcon,
  BookOpenCheckIcon,
  CheckSquare2Icon,
  FileTextIcon,
  FolderKanbanIcon,
  HardDriveIcon,
  HeartPulseIcon,
  LightbulbIcon,
  MessageSquareQuoteIcon,
  OrbitIcon,
  ServerIcon,
  WrenchIcon,
} from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { RuntimeTaskId } from "@t3tools/contracts";
import type {
  PortfolioHeartbeatOwnerClaimRequest,
  PortfolioHeartbeatReceipt,
  PortfolioHeartbeatRecord,
  PortfolioTask,
  PortfolioTaskStatus,
  PortfolioWishlist,
  StorageInventoryEntry,
} from "@t3tools/contracts";
import { useEnvironments, usePrimaryEnvironmentId } from "../state/environments";
import { useProjects, useThread, useThreadShells } from "../state/entities";
import { useStorageInventory } from "../state/storageInventory";
import {
  portfolioEnvironment,
  usePortfolioHeartbeatOwner,
  usePortfolioHeartbeatOwnerPair,
  usePortfolioHeartbeatRecords,
  usePortfolioTasks,
  usePortfolioWishlists,
} from "../state/portfolio";
import { threadEnvironment } from "../state/threads";
import { useAtomCommand } from "../state/use-atom-command";
import { squashAtomCommandFailure } from "@t3tools/client-runtime/state/runtime";
import { cn, newCommandId, newMessageId } from "../lib/utils";
import { DEFAULT_HUNG_TURN_THRESHOLD_MS } from "../portfolioTurnRecovery";
import {
  buildNativeHeartbeatTargets,
  type NativeHeartbeatTarget,
} from "../portfolioHeartbeatTargets";
import { buildPausedNativeHeartbeatDraft } from "../portfolioHeartbeatDraft";
import { dispatchPortfolioHeartbeatNativeTurn } from "../portfolioHeartbeatDispatch";
import {
  buildPortfolioHeartbeatReceipt,
  decidePortfolioHeartbeatRunCompletion,
} from "../portfolioHeartbeatLifecycle";
import {
  buildPortfolioRotationRows,
  groupPortfolioRotationRows,
  latestUserPrompt,
  PORTFOLIO_ROTATION_GROUPING_OPTIONS,
  PORTFOLIO_ROTATION_SORT_OPTIONS,
  sortPortfolioRotationRows,
  type PortfolioRotationGrouping,
  type PortfolioRotationSort,
} from "../portfolioRotation";
import { resolvePortfolioRotationAuthority } from "../portfolioRotationAuthority";
import { buildReviewedPortfolioRotationRequest } from "../portfolioRotationRequest";
import { PORTFOLIO_WORKFLOWS, type PortfolioWorkflow } from "../portfolioWorkflows";
import { heartbeatOwnerRoleLabel, normalizeHeartbeatOwnerState } from "../portfolioHeartbeatOwner";
import { buildPortfolioHeartbeatOwnerTransferPreview } from "../portfolioHeartbeatOwnerTransferPreview";
import {
  formatPortfolioTaskAssignedAgent,
  formatPortfolioTaskChecklistProgress,
  formatPortfolioTaskEnvironmentLabel,
  formatPortfolioTaskUpdatedAt,
} from "../portfolioTaskPresentation";
import {
  formatPortfolioHeartbeatCadence,
  formatPortfolioHeartbeatEnvironmentLabel,
  formatPortfolioHeartbeatNextRun,
  formatPortfolioHeartbeatRuns,
  formatPortfolioHeartbeatUpdatedAt,
} from "../portfolioHeartbeatPresentation";
import {
  classifyContextRotationHealth,
  CONTEXT_ROTATION_REQUIRED_TOKENS,
  CONTEXT_ROTATION_WATCH_TOKENS,
} from "../portfolioContextHealth";
import { deriveLatestContextWindowSnapshot, formatContextWindowTokens } from "../lib/contextWindow";
import { SidebarContent, SidebarGroup, useSidebar } from "./ui/sidebar";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "./ui/select";

export type PortfolioMode = "portfolio" | null;
export type PortfolioDestination =
  | "heartbeats"
  | "rotations"
  | "tasks"
  | "wishlist"
  | "agents"
  | "hosts"
  | "storage"
  | "workflows"
  | "projects"
  | "documents"
  | "trajectory"
  | "rants";

type ModeSetter = Dispatch<SetStateAction<PortfolioMode>>;

type HeartbeatProofState = {
  readonly targetKey: string;
  readonly lifecycle: ReturnType<typeof buildPausedNativeHeartbeatDraft>["lifecycle"];
  readonly runId: string | null;
  readonly receipt: PortfolioHeartbeatReceipt | null;
  readonly busy: boolean;
};

const portfolioDestinations: ReadonlyArray<{
  id: PortfolioDestination;
  label: string;
  icon: typeof HeartPulseIcon;
  draft?: boolean;
}> = [
  { id: "heartbeats", label: "Heartbeats", icon: HeartPulseIcon },
  { id: "rotations", label: "Rotations", icon: OrbitIcon },
  { id: "tasks", label: "Tasks", icon: CheckSquare2Icon },
  { id: "wishlist", label: "Wishlist", icon: LightbulbIcon },
  { id: "agents", label: "Agents", icon: BotIcon },
  { id: "hosts", label: "Host Health", icon: ServerIcon },
  { id: "storage", label: "Storage", icon: HardDriveIcon },
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
  const navigate = useNavigate();
  const { environments } = useEnvironments();
  const environmentLabels = useMemo(
    () =>
      new Map(
        environments.map((environment) => [String(environment.environmentId), environment.label]),
      ),
    [environments],
  );
  const primaryEnvironmentId = usePrimaryEnvironmentId();
  const tasksQuery = usePortfolioTasks(primaryEnvironmentId);
  const wishlistsQuery = usePortfolioWishlists(primaryEnvironmentId);
  const heartbeatRecordsQuery = usePortfolioHeartbeatRecords(primaryEnvironmentId);
  const projects = useProjects();
  const threads = useThreadShells();
  const startThreadTurn = useAtomCommand(threadEnvironment.startTurn, { reportFailure: false });
  const recordHeartbeatReceipt = useAtomCommand(portfolioEnvironment.recordHeartbeatReceipt, {
    reportFailure: false,
  });
  const transitionTaskStatus = useAtomCommand(portfolioEnvironment.transitionTaskStatus, {
    reportFailure: false,
  });
  const createTask = useAtomCommand(portfolioEnvironment.createTask, {
    reportFailure: false,
  });
  const recordTaskReceipt = useAtomCommand(portfolioEnvironment.recordTaskReceipt, {
    reportFailure: false,
  });
  const createWishlist = useAtomCommand(portfolioEnvironment.createWishlist, {
    reportFailure: false,
  });
  const promoteWishlist = useAtomCommand(portfolioEnvironment.promoteWishlist, {
    reportFailure: false,
  });
  const upsertHeartbeatRecord = useAtomCommand(portfolioEnvironment.upsertHeartbeatRecord, {
    reportFailure: false,
  });
  const claimHeartbeatOwner = useAtomCommand(portfolioEnvironment.claimHeartbeatOwner, {
    reportFailure: false,
  });
  const heartbeatTargets = useMemo(
    () => buildNativeHeartbeatTargets(projects, threads),
    [projects, threads],
  );
  const [selectedHeartbeatTargetKey, setSelectedHeartbeatTargetKey] = useState<string | null>(null);
  const [heartbeatView, setHeartbeatView] = useState<"current" | "cards">("current");
  const [selectedRotationKey, setSelectedRotationKey] = useState<string | null>(null);
  const selectedHeartbeatTarget =
    heartbeatTargets.find((target) => target.key === selectedHeartbeatTargetKey) ??
    heartbeatTargets[0] ??
    null;
  const selectedRotationTarget =
    heartbeatTargets.find((target) => target.key === selectedRotationKey) ??
    heartbeatTargets[0] ??
    null;
  const selectedNativeTarget =
    destination === "rotations" ? selectedRotationTarget : selectedHeartbeatTarget;
  const selectedThread = useThread(
    (destination === "heartbeats" || destination === "rotations") && selectedNativeTarget
      ? {
          environmentId: selectedNativeTarget.environmentId,
          threadId: selectedNativeTarget.threadId,
        }
      : null,
  );
  const selectedContextUsage = useMemo(
    () => deriveLatestContextWindowSnapshot(selectedThread?.activities ?? []),
    [selectedThread?.activities],
  );
  const heartbeatOwnerQuery = usePortfolioHeartbeatOwner(
    destination === "heartbeats" && selectedHeartbeatTarget
      ? selectedHeartbeatTarget.environmentId
      : null,
  );
  const heartbeatOwner = useMemo(
    () => normalizeHeartbeatOwnerState(heartbeatOwnerQuery.data),
    [heartbeatOwnerQuery.data],
  );
  const selectedHeartbeatEnvironment = environments.find(
    (environment) => environment.environmentId === selectedHeartbeatTarget?.environmentId,
  );
  const heartbeatOwnerEndpointSupported =
    selectedHeartbeatEnvironment?.serverConfig === undefined ||
    selectedHeartbeatEnvironment.serverConfig === null ||
    selectedHeartbeatEnvironment.serverConfig.environment.capabilities.portfolioHeartbeatOwner ===
      true;
  const heartbeatOwnerPairQuery = usePortfolioHeartbeatOwnerPair(
    primaryEnvironmentId,
    selectedHeartbeatTarget?.environmentId ?? null,
  );
  const heartbeatOwnerPair = useMemo(
    () => ({
      source: normalizeHeartbeatOwnerState(heartbeatOwnerPairQuery.source.data),
      target: normalizeHeartbeatOwnerState(heartbeatOwnerPairQuery.target.data),
    }),
    [heartbeatOwnerPairQuery.source.data, heartbeatOwnerPairQuery.target.data],
  );
  const heartbeatTransferPreview = useMemo(() => {
    if (!primaryEnvironmentId || !selectedHeartbeatTarget) return null;
    const sourceDescriptor = heartbeatOwnerPair.source.descriptor;
    const targetDescriptor = heartbeatOwnerPair.target.descriptor;
    const proposedOwnerEpoch = (sourceDescriptor?.ownerEpoch ?? -1) + 1;
    return buildPortfolioHeartbeatOwnerTransferPreview({
      source: sourceDescriptor
        ? {
            environmentId: primaryEnvironmentId,
            role: heartbeatOwnerPair.source.role,
            descriptor: sourceDescriptor,
          }
        : null,
      target: targetDescriptor
        ? {
            environmentId: selectedHeartbeatTarget.environmentId,
            role: heartbeatOwnerPair.target.role,
            descriptor: targetDescriptor,
          }
        : null,
      proposedOwnerEpoch,
      existingOwnerEnvironmentIds: [String(primaryEnvironmentId)],
    });
  }, [heartbeatOwnerPair, primaryEnvironmentId, selectedHeartbeatTarget]);
  const selectedHeartbeatDraft = selectedHeartbeatTarget
    ? buildPausedNativeHeartbeatDraft(selectedHeartbeatTarget)
    : null;
  const [heartbeatProof, setHeartbeatProof] = useState<HeartbeatProofState | null>(null);
  const selectedHeartbeatProof =
    heartbeatProof && heartbeatProof.targetKey === selectedHeartbeatTarget?.key
      ? heartbeatProof
      : null;
  const canDispatchHeartbeatProof =
    heartbeatOwner.role === "owner" &&
    selectedHeartbeatTarget !== null &&
    selectedThread !== null &&
    selectedThread.id === selectedHeartbeatTarget.threadId &&
    selectedThread.environmentId === selectedHeartbeatTarget.environmentId &&
    selectedThread.projectId === selectedHeartbeatTarget.projectId;
  const rotationRows = useMemo(
    () =>
      buildPortfolioRotationRows({
        projects,
        threads,
        environments: new Map(
          environments.map((environment) => [
            String(environment.environmentId),
            {
              label: environment.label,
              platform: environment.serverConfig?.environment.platform ?? null,
              ...(environment.serverConfig?.environment.serverVersion
                ? { serverVersion: environment.serverConfig.environment.serverVersion }
                : {}),
              connectionStatus: environment.connection,
            },
          ]),
        ),
        ...(selectedThread && selectedNativeTarget
          ? {
              telemetryByThread: new Map([
                [
                  `${selectedNativeTarget.environmentId}:${selectedNativeTarget.threadId}`,
                  selectedContextUsage,
                ],
              ]),
              latestPromptByThread: new Map([
                [
                  `${selectedNativeTarget.environmentId}:${selectedNativeTarget.threadId}`,
                  latestUserPrompt(selectedThread.messages),
                ],
              ]),
            }
          : {}),
      }),
    [
      environments,
      projects,
      selectedContextUsage,
      selectedHeartbeatTarget,
      selectedNativeTarget,
      selectedThread,
      threads,
    ],
  );
  const [rotationSort, setRotationSort] = useState<PortfolioRotationSort>("attention");
  const [rotationGrouping, setRotationGrouping] = useState<PortfolioRotationGrouping>("none");
  const sortedRotationRows = useMemo(
    () => sortPortfolioRotationRows(rotationRows, rotationSort),
    [rotationRows, rotationSort],
  );
  const selectedRotation =
    sortedRotationRows.find((row) => row.key === selectedRotationKey) ??
    sortedRotationRows[0] ??
    null;
  const dispatchToRotationTarget = useCallback(
    async (text: string): Promise<{ ok: boolean; detail: string }> => {
      if (
        !selectedRotation ||
        !selectedThread ||
        selectedThread.id !== selectedRotation.threadId ||
        selectedThread.environmentId !== selectedRotation.environmentId ||
        selectedThread.projectId !== selectedRotation.projectId
      ) {
        return { ok: false, detail: "The target thread is not loaded yet." };
      }
      const commandId = newCommandId();
      const result = await startThreadTurn({
        environmentId: selectedRotation.environmentId,
        input: {
          commandId,
          threadId: selectedRotation.threadId,
          message: {
            messageId: newMessageId(),
            role: "user",
            text,
            attachments: [],
          },
          modelSelection: selectedThread.modelSelection,
          runtimeMode: selectedThread.runtimeMode,
          interactionMode: selectedThread.interactionMode,
          createdAt: new Date().toISOString(),
        },
      });
      return result._tag === "Success"
        ? {
            ok: true,
            detail: `Native turn accepted (sequence ${result.value.sequence}, command ${commandId}).`,
          }
        : { ok: false, detail: nativeDispatchFailureDetail(result) };
    },
    [selectedRotation, selectedThread, startThreadTurn],
  );
  const requestReviewedRotation = useCallback(
    async (row: ReturnType<typeof buildPortfolioRotationRows>[number]) => {
      if (
        !selectedThread ||
        selectedThread.id !== row.threadId ||
        selectedThread.environmentId !== row.environmentId ||
        selectedThread.projectId !== row.projectId
      ) {
        return { ok: false, detail: "The target thread is not loaded yet." };
      }
      const prepared = buildReviewedPortfolioRotationRequest({ row, reviewed: true });
      if (!prepared.ok) return { ok: false, detail: "Explicit review is required." };
      const commandId = newCommandId();
      const result = await startThreadTurn({
        environmentId: prepared.request.target.environmentId,
        input: {
          commandId,
          threadId: prepared.request.target.threadId,
          message: {
            messageId: newMessageId(),
            role: "user",
            text: prepared.request.prompt,
            attachments: [],
          },
          modelSelection: selectedThread.modelSelection,
          runtimeMode: selectedThread.runtimeMode,
          interactionMode: selectedThread.interactionMode,
          createdAt: new Date().toISOString(),
        },
      });
      return result._tag === "Success"
        ? {
            ok: true,
            detail:
              "Reviewed native Rotate request accepted (sequence " +
              result.value.sequence +
              ", command " +
              commandId +
              ").",
          }
        : { ok: false, detail: nativeDispatchFailureDetail(result) };
    },
    [selectedThread, startThreadTurn],
  );
  const dispatchHeartbeatProof = useCallback(async () => {
    if (
      !selectedHeartbeatTarget ||
      !selectedHeartbeatDraft ||
      !selectedThread ||
      selectedThread.id !== selectedHeartbeatTarget.threadId ||
      selectedThread.environmentId !== selectedHeartbeatTarget.environmentId ||
      selectedThread.projectId !== selectedHeartbeatTarget.projectId ||
      heartbeatOwner.role !== "owner" ||
      selectedHeartbeatProof?.busy ||
      selectedHeartbeatProof?.lifecycle.activeRunId != null
    ) {
      return;
    }

    const target = selectedHeartbeatTarget;
    const lifecycle = selectedHeartbeatProof?.lifecycle ?? selectedHeartbeatDraft.lifecycle;
    const runId = newCommandId();
    const commandId = newCommandId();
    const messageId = newMessageId();
    setHeartbeatProof({
      targetKey: target.key,
      lifecycle,
      runId,
      receipt: null,
      busy: true,
    });

    const prepared = await dispatchPortfolioHeartbeatNativeTurn({
      lifecycle,
      runId,
      commandId,
      messageId,
      message:
        "Heartbeat proof: report the current task state, then stop after this one response. Do not start follow-up work.",
      now: new Date().toISOString(),
      runtimeMode: selectedThread.runtimeMode,
      interactionMode: selectedThread.interactionMode,
      send: async (command) => {
        const result = await startThreadTurn({
          environmentId: command.environmentId,
          input: {
            ...command.command,
            modelSelection: selectedThread.modelSelection,
          },
        });
        return result._tag === "Success"
          ? { accepted: true, sequence: result.value.sequence }
          : { accepted: false, detail: nativeDispatchFailureDetail(result) };
      },
    });

    setHeartbeatProof({
      targetKey: target.key,
      lifecycle: prepared.lifecycle,
      runId: prepared.lifecycle.activeRunId,
      receipt: prepared.receipt,
      busy: false,
    });
  }, [
    heartbeatOwner.role,
    selectedHeartbeatDraft,
    selectedHeartbeatProof,
    selectedHeartbeatTarget,
    selectedThread,
    startThreadTurn,
  ]);
  const confirmHeartbeatProof = useCallback(async () => {
    if (
      !selectedHeartbeatTarget ||
      !selectedHeartbeatProof ||
      selectedHeartbeatProof.busy ||
      selectedHeartbeatProof.runId === null ||
      selectedHeartbeatProof.receipt?.status !== "dispatched"
    ) {
      return;
    }

    const completedAt = new Date().toISOString();
    const decision = decidePortfolioHeartbeatRunCompletion(selectedHeartbeatProof.lifecycle, {
      runId: selectedHeartbeatProof.runId,
      completedAt,
    });
    if (!decision.accepted) return;

    const receipt = buildPortfolioHeartbeatReceipt({
      commandId: selectedHeartbeatProof.receipt.commandId,
      target: selectedHeartbeatTarget,
      status: "transcript-confirmed",
      observedAt: completedAt,
      sequence: selectedHeartbeatProof.receipt.sequence,
      detail: "Operator confirmed the one bounded Heartbeat proof in the native thread.",
    });
    const persisted = await recordHeartbeatReceipt({
      environmentId: selectedHeartbeatTarget.environmentId,
      input: receipt,
    });
    const receiptAfterPersistence =
      persisted._tag === "Success"
        ? receipt
        : buildPortfolioHeartbeatReceipt({
            ...receipt,
            status: "confirmation-delayed",
            detail:
              "Transcript was confirmed locally, but the owner receipt could not be persisted; retry readback before resuming.",
          });

    setHeartbeatProof({
      targetKey: selectedHeartbeatTarget.key,
      lifecycle: decision.state,
      runId: null,
      receipt: receiptAfterPersistence,
      busy: false,
    });
  }, [recordHeartbeatReceipt, selectedHeartbeatProof, selectedHeartbeatTarget]);
  const claimSelectedHeartbeatOwner = useCallback(
    async (
      input: Omit<PortfolioHeartbeatOwnerClaimRequest, "target">,
    ): Promise<{ ok: boolean; detail: string }> => {
      if (!selectedHeartbeatTarget || !heartbeatOwnerEndpointSupported) {
        return {
          ok: false,
          detail: "This environment does not advertise the native Heartbeat owner contract.",
        };
      }
      const result = await claimHeartbeatOwner({
        environmentId: selectedHeartbeatTarget.environmentId,
        input: {
          ...input,
          target: {
            environmentId: selectedHeartbeatTarget.environmentId,
            projectId: selectedHeartbeatTarget.projectId,
            threadId: selectedHeartbeatTarget.threadId,
          },
        },
      });
      return result._tag === "Success"
        ? {
            ok: true,
            detail: `Owner claim accepted for epoch ${result.value.descriptor?.ownerEpoch ?? "unknown"}.`,
          }
        : { ok: false, detail: ownerClaimFailureDetail(result) };
    },
    [claimHeartbeatOwner, heartbeatOwnerEndpointSupported, selectedHeartbeatTarget],
  );
  const titles: Record<PortfolioDestination, { title: string; description: string }> = {
    heartbeats: {
      title: "Heartbeats",
      description:
        "Native Heartbeat entry point. Owner readback and a paused lifecycle model are available; scheduling remains disabled.",
    },
    rotations: {
      title: "Rotations",
      description:
        "Read-only native session health. Rotation state is derived from existing context/token telemetry; no successor or cutover action is connected.",
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
    storage: {
      title: "Storage",
      description:
        "Read-only storage inventory measures fixed host roots; context health, transcript footprint, and database footprint remain separate.",
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
            <div className="mb-5 flex flex-wrap items-center gap-2" aria-label="Heartbeat view">
              <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Presentation
              </span>
              <button
                type="button"
                aria-pressed={heartbeatView === "current"}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                  heartbeatView === "current"
                    ? "border-sky-400/50 bg-sky-400/15 text-sky-200"
                    : "border-border/70 text-muted-foreground hover:bg-background/30",
                )}
                onClick={() => setHeartbeatView("current")}
              >
                Current view
              </button>
              <button
                type="button"
                aria-pressed={heartbeatView === "cards"}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                  heartbeatView === "cards"
                    ? "border-sky-400/50 bg-sky-400/15 text-sky-200"
                    : "border-border/70 text-muted-foreground hover:bg-background/30",
                )}
                onClick={() => setHeartbeatView("cards")}
              >
                Cards view
              </button>
            </div>
            {heartbeatView === "current" ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-medium">Native Heartbeat foundation</h2>
                  <span className="rounded-full border border-sky-400/30 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-sky-300">
                    {selectedHeartbeatProof?.lifecycle.state ?? "paused"}
                  </span>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  Select a real native T3 thread as a future target. Scheduling, persistence,
                  polling, and automatic follow-up are not enabled. One explicit bounded proof is
                  available only after native ownership is established.
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
                    Showing the 20 most relevant native threads. The full project/thread inbox
                    remains available from Agents.
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
                      Native ownership and receipts are read back here; scheduling remains paused,
                      and only one owner-gated bounded proof can dispatch.
                    </p>
                    <button
                      type="button"
                      className="mt-3 rounded-md border border-border px-3 py-2 text-xs font-medium text-foreground hover:bg-muted/50"
                      onClick={() => {
                        setMode(null);
                        void navigate({
                          to: "/$environmentId/$threadId",
                          params: {
                            environmentId: selectedHeartbeatTarget.environmentId,
                            threadId: selectedHeartbeatTarget.threadId,
                          },
                        });
                      }}
                    >
                      Open native thread
                    </button>
                  </div>
                ) : null}
                <ContextRotationCard usage={selectedContextUsage} />
                <HeartbeatOwnerCard
                  owner={heartbeatOwner}
                  isPending={heartbeatOwnerQuery.isPending}
                  canClaim={heartbeatOwnerEndpointSupported}
                  onClaim={claimSelectedHeartbeatOwner}
                />
                {heartbeatTransferPreview ? (
                  <HeartbeatTransferPreviewCard
                    preview={heartbeatTransferPreview}
                    sourceEnvironmentId={primaryEnvironmentId}
                    targetEnvironmentId={selectedHeartbeatTarget?.environmentId ?? null}
                    isPending={
                      heartbeatOwnerPairQuery.source.isPending ||
                      heartbeatOwnerPairQuery.target.isPending
                    }
                  />
                ) : null}
                {selectedHeartbeatDraft ? (
                  <HeartbeatDraftCard
                    draft={selectedHeartbeatDraft}
                    proof={selectedHeartbeatProof}
                    canDispatch={canDispatchHeartbeatProof}
                    onDispatch={() => void dispatchHeartbeatProof()}
                    onConfirm={() => void confirmHeartbeatProof()}
                  />
                ) : null}
              </>
            ) : (
              <HeartbeatCardsView
                records={heartbeatRecordsQuery.data?.records ?? []}
                tasks={tasksQuery.data?.tasks ?? []}
                targets={heartbeatTargets}
                environmentLabels={environmentLabels}
                ownerLabel={
                  environmentLabels.get(String(primaryEnvironmentId)) ?? "Portfolio owner"
                }
                onUpsert={async (record) => {
                  await upsertHeartbeatRecord({
                    environmentId: record.target.environmentId,
                    input: record,
                  });
                }}
              />
            )}
          </section>
        ) : null}
        {destination === "rotations" ? (
          <RotationView
            rows={sortedRotationRows}
            grouping={rotationGrouping}
            sort={rotationSort}
            onSortChange={setRotationSort}
            onGroupingChange={setRotationGrouping}
            selectedKey={selectedRotation?.key ?? null}
            onSelect={setSelectedRotationKey}
            onOpen={(row) => {
              setMode(null);
              void navigate({
                to: "/$environmentId/$threadId",
                params: { environmentId: row.environmentId, threadId: row.threadId },
              });
            }}
            onDispatch={dispatchToRotationTarget}
            onRequestRotation={requestReviewedRotation}
          />
        ) : null}
        {destination === "tasks" ? (
          <TasksList
            tasks={tasksQuery.data?.tasks ?? []}
            isPending={tasksQuery.isPending}
            targets={heartbeatTargets}
            heartbeats={heartbeatRecordsQuery.data?.records ?? []}
            environmentLabels={environmentLabels}
            onCreateTask={async ({
              title,
              outcome,
              priority,
              status,
              completionCondition,
              checklistItems,
              target,
              heartbeat,
            }) => {
              const now = new Date().toISOString();
              const heartbeatId = heartbeat?.enabled ? newCommandId() : null;
              const taskId = RuntimeTaskId.make(newCommandId());
              await createTask({
                environmentId: target.environmentId,
                input: {
                  taskId,
                  title,
                  outcome,
                  target: {
                    environmentId: target.environmentId,
                    projectId: target.projectId,
                    threadId: target.threadId,
                  },
                  status,
                  priority,
                  assignment: { ownerPassportId: null, ownerHost: null },
                  checklistItems,
                  completionCondition,
                  planLinks: [],
                  evidenceLinks: [],
                  createdAt: now,
                  updatedAt: now,
                  completedAt: null,
                  revision: 1,
                  lastReceipt: null,
                  heartbeatId,
                },
              });
              if (heartbeat?.enabled && heartbeatId !== null) {
                await upsertHeartbeatRecord({
                  environmentId: target.environmentId,
                  input: {
                    heartbeatId,
                    taskId,
                    message: heartbeat.message,
                    nextRunAt: null,
                    target: {
                      environmentId: target.environmentId,
                      projectId: target.projectId,
                      threadId: target.threadId,
                    },
                    status: "paused",
                    cadenceMinutes: heartbeat.cadenceMinutes,
                    maxRuns: heartbeat.maxRuns,
                    runCount: 0,
                    expiresAt: null,
                    finishLine: completionCondition,
                    stopConditions: [
                      "Task reaches complete",
                      "Task is blocked",
                      "Operator pauses the Heartbeat",
                    ],
                    preventOverlap: true,
                    pauseReason: "Configured from Task; awaiting explicit native start.",
                    stopReason: null,
                    lastReceipt: null,
                    updatedAt: now,
                  },
                });
              }
            }}
            onDispatchTask={async (task) => {
              const commandId = newCommandId();
              const observedAt = new Date().toISOString();
              const result = await startThreadTurn({
                environmentId: task.target.environmentId,
                input: {
                  commandId,
                  threadId: task.target.threadId,
                  message: {
                    messageId: newMessageId(),
                    role: "user",
                    text: `Task: ${task.title}\n\nExpected outcome: ${task.outcome}`,
                    attachments: [],
                  },
                  runtimeMode: "full-access",
                  interactionMode: "default",
                  createdAt: observedAt,
                },
              });
              if (result._tag !== "Success") return;
              await recordTaskReceipt({
                environmentId: task.target.environmentId,
                input: {
                  taskId: task.taskId,
                  target: task.target,
                  expectedRevision: task.revision,
                  receipt: {
                    commandId,
                    target: task.target,
                    status: "dispatched",
                    sequence: result.value.sequence,
                    observedAt,
                    detail: `Task dispatch accepted by native T3 (sequence ${result.value.sequence}).`,
                  },
                },
              });
            }}
            onStatusChange={(task, status) => {
              void transitionTaskStatus({
                environmentId: task.target.environmentId,
                input: {
                  taskId: task.taskId,
                  target: task.target,
                  expectedRevision: task.revision,
                  status,
                  updatedAt: new Date().toISOString(),
                },
              });
            }}
            onHeartbeatUpsert={async (record) => {
              await upsertHeartbeatRecord({
                environmentId: record.target.environmentId,
                input: record,
              });
            }}
          />
        ) : null}
        {destination === "wishlist" ? (
          <WishlistPreview
            wishlists={wishlistsQuery.data?.wishlists ?? []}
            isPending={wishlistsQuery.isPending}
            targets={heartbeatTargets}
            onCreate={async ({ title, summary, priority }) => {
              if (!primaryEnvironmentId) return;
              const now = new Date().toISOString();
              await createWishlist({
                environmentId: primaryEnvironmentId,
                input: {
                  wishlistId: newCommandId(),
                  title,
                  summary,
                  status: "idea",
                  priority,
                  links: [],
                  createdAt: now,
                  updatedAt: now,
                  revision: 1,
                  promotedTaskId: null,
                },
              });
            }}
            onPromote={async ({ wishlist, target }) => {
              if (!primaryEnvironmentId) return;
              const now = new Date().toISOString();
              const taskId = RuntimeTaskId.make(newCommandId());
              await createTask({
                environmentId: target.environmentId,
                input: {
                  taskId,
                  title: wishlist.title,
                  outcome: wishlist.summary,
                  target: {
                    environmentId: target.environmentId,
                    projectId: target.projectId,
                    threadId: target.threadId,
                  },
                  status: "draft",
                  priority: wishlist.priority,
                  assignment: { ownerPassportId: null, ownerHost: null },
                  checklistItems: [],
                  completionCondition: "Task status reaches complete",
                  planLinks: wishlist.links,
                  evidenceLinks: [],
                  createdAt: now,
                  updatedAt: now,
                  completedAt: null,
                  revision: 1,
                  lastReceipt: null,
                  heartbeatId: null,
                },
              });
              await promoteWishlist({
                environmentId: primaryEnvironmentId,
                input: {
                  wishlistId: wishlist.wishlistId,
                  expectedRevision: wishlist.revision,
                  promotedTaskId: taskId,
                  updatedAt: now,
                },
              });
            }}
          />
        ) : null}
        {destination === "hosts" ? <NativeEnvironmentInventoryView /> : null}
        {destination === "storage" ? <StorageFootprintPreview /> : null}
        {destination === "agents" ? <NativeAgentMessagingView setMode={setMode} /> : null}
        {destination === "workflows" ? <WorkflowCatalog /> : null}
      </div>
    </main>
  );
}

function nativeDispatchFailureDetail(
  result: Parameters<typeof squashAtomCommandFailure>[0],
): string {
  const failure = squashAtomCommandFailure(result);
  if (typeof failure === "object" && failure !== null) {
    const tag = "_tag" in failure && typeof failure._tag === "string" ? failure._tag : null;
    const message =
      "message" in failure && typeof failure.message === "string" ? failure.message : null;
    if (tag && message) return `Native turn rejected (${tag}): ${message}`;
    if (tag) return `Native turn rejected (${tag}).`;
    if (message) return `Native turn rejected: ${message}`;
  }
  return "Native turn rejected by the target environment.";
}

function ownerClaimFailureDetail(result: Parameters<typeof squashAtomCommandFailure>[0]): string {
  const failure = squashAtomCommandFailure(result);
  if (typeof failure === "object" && failure !== null) {
    const tag = "_tag" in failure && typeof failure._tag === "string" ? failure._tag : null;
    const message =
      "message" in failure && typeof failure.message === "string" ? failure.message : null;
    if (tag && message) return `Owner claim rejected (${tag}): ${message}`;
    if (tag) return `Owner claim rejected (${tag}).`;
    if (message) return `Owner claim rejected: ${message}`;
  }
  return "Owner claim rejected by the target environment.";
}

function HeartbeatCardsView({
  records,
  tasks,
  targets,
  environmentLabels,
  ownerLabel,
  onUpsert,
}: {
  readonly records: ReadonlyArray<PortfolioHeartbeatRecord>;
  readonly tasks: ReadonlyArray<PortfolioTask>;
  readonly targets: ReadonlyArray<NativeHeartbeatTarget>;
  readonly environmentLabels: ReadonlyMap<string, string>;
  readonly ownerLabel: string;
  readonly onUpsert: (record: PortfolioHeartbeatRecord) => Promise<void>;
}) {
  const [selectedHeartbeatId, setSelectedHeartbeatId] = useState<string | null>(null);
  const [appearance, setAppearance] = useState<"t3" | "midnight">("t3");
  const [messageDraft, setMessageDraft] = useState("");
  const [messageSaveState, setMessageSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const isMidnight = appearance === "midnight";
  const panelClass = isMidnight
    ? "border-slate-700 bg-slate-950 text-slate-100"
    : "border-border/70 bg-card/30 text-foreground";
  const blockClass = isMidnight
    ? "border-slate-700/80 bg-slate-900/70"
    : "border-border/60 bg-background/30";
  const mutedClass = isMidnight ? "text-slate-300" : "text-muted-foreground";
  const strongClass = isMidnight ? "text-slate-100" : "text-foreground";
  const statusClass = (status: PortfolioHeartbeatRecord["status"]) =>
    status === "active"
      ? "border-sky-400/40 bg-sky-400/10 text-sky-700 dark:text-sky-200"
      : status === "blocked" || status === "stopped"
        ? "border-amber-400/40 bg-amber-400/10 text-amber-700 dark:text-amber-200"
        : isMidnight
          ? "border-slate-600 bg-slate-800 text-slate-200"
          : "border-border bg-muted/40 text-muted-foreground";
  const selectedRecord =
    records.find((record) => record.heartbeatId === selectedHeartbeatId) ?? records[0] ?? null;
  const selectedTask = selectedRecord?.taskId
    ? (tasks.find((task) => String(task.taskId) === String(selectedRecord.taskId)) ?? null)
    : null;
  const selectedTarget = selectedRecord
    ? (targets.find(
        (target) =>
          String(target.environmentId) === String(selectedRecord.target.environmentId) &&
          String(target.projectId) === String(selectedRecord.target.projectId) &&
          String(target.threadId) === String(selectedRecord.target.threadId),
      ) ?? null)
    : null;
  useEffect(() => {
    setMessageDraft(selectedRecord?.message ?? "");
    setMessageSaveState("idle");
  }, [selectedRecord?.heartbeatId, selectedRecord?.message]);
  const saveMessage = async () => {
    if (!selectedRecord || messageSaveState === "saving") return;
    setMessageSaveState("saving");
    await onUpsert({
      ...selectedRecord,
      message: messageDraft.trim() || null,
      updatedAt: new Date().toISOString(),
    });
    setMessageSaveState("saved");
  };
  const updateStatus = (status: PortfolioHeartbeatRecord["status"]) => {
    if (!selectedRecord) return;
    void onUpsert({
      ...selectedRecord,
      status,
      nextRunAt: status === "stopped" ? null : (selectedRecord.nextRunAt ?? null),
      pauseReason: status === "paused" ? "Paused from Heartbeats Cards view." : null,
      stopReason: status === "stopped" ? "Stopped from Heartbeats Cards view." : null,
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <div aria-label="Heartbeat cards" className={cn("space-y-4", strongClass)}>
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3",
          panelClass,
        )}
      >
        <div>
          <p className={cn("text-xs font-semibold uppercase tracking-wide", mutedClass)}>
            Cards appearance
          </p>
          <p className={cn("mt-1 text-sm", mutedClass)}>
            Choose the presentation surface for this view.
          </p>
        </div>
        <div
          className="flex rounded-md border border-border/70 p-0.5"
          aria-label="Cards appearance"
        >
          {(["t3", "midnight"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={appearance === value}
              onClick={() => setAppearance(value)}
              className={cn(
                "rounded px-3 py-1.5 text-xs font-medium transition-colors",
                appearance === value
                  ? "bg-sky-500 text-white"
                  : cn("hover:bg-muted/50", mutedClass),
              )}
            >
              {value === "t3" ? "T3" : "Midnight"}
            </button>
          ))}
        </div>
      </div>
      {records.length === 0 ? (
        <p className={cn("rounded-xl border p-5 text-sm", panelClass, mutedClass)}>
          No owner-backed Heartbeats are available yet.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
          <ul className="space-y-3">
            {records.map((record) => {
              const target = targets.find(
                (candidate) =>
                  String(candidate.environmentId) === String(record.target.environmentId) &&
                  String(candidate.projectId) === String(record.target.projectId) &&
                  String(candidate.threadId) === String(record.target.threadId),
              );
              const isSelected = record.heartbeatId === selectedRecord?.heartbeatId;
              return (
                <li key={record.heartbeatId}>
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setSelectedHeartbeatId(record.heartbeatId)}
                    className={cn(
                      "w-full rounded-xl border p-4 text-left shadow-sm transition-colors",
                      isSelected
                        ? cn(
                            "border-sky-400/60 shadow-sky-900/10",
                            isMidnight ? "bg-slate-800 text-slate-100" : "bg-sky-400/10",
                          )
                        : cn(panelClass, "hover:border-sky-400/40"),
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className={cn("truncate font-medium", strongClass)}>
                          {record.taskId
                            ? (tasks.find((task) => String(task.taskId) === String(record.taskId))
                                ?.title ?? "Linked Heartbeat")
                            : "Standalone Heartbeat"}
                        </h3>
                        <p className={cn("mt-1 truncate text-xs", mutedClass)}>
                          {formatPortfolioHeartbeatEnvironmentLabel(
                            String(record.target.environmentId),
                            environmentLabels,
                          )}{" "}
                          · {target?.projectTitle ?? "Unknown project"} ·{" "}
                          {target?.threadTitle ?? "Unknown thread"}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 rounded-full border px-2 py-1 text-[10px] uppercase tracking-wide",
                          statusClass(record.status),
                        )}
                      >
                        {record.status}
                      </span>
                    </div>
                    <div className={cn("mt-3 grid gap-2 text-xs sm:grid-cols-3", mutedClass)}>
                      <span>{formatPortfolioHeartbeatCadence(record.cadenceMinutes)}</span>
                      <span>{formatPortfolioHeartbeatRuns(record)}</span>
                      <span>Next: {formatPortfolioHeartbeatNextRun(record.nextRunAt)}</span>
                    </div>
                    {record.message ? (
                      <p className={cn("mt-3 line-clamp-2 text-xs", mutedClass)}>
                        {record.message}
                      </p>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
          {selectedRecord ? (
            <aside
              aria-label="Selected Heartbeat details"
              className={cn(
                "h-fit rounded-xl border p-5 shadow-lg",
                panelClass,
                isMidnight ? "shadow-black/30" : "shadow-border/20",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-600 dark:text-sky-300">
                    Heartbeat detail
                  </p>
                  <h3 className={cn("mt-1 text-lg font-semibold", strongClass)}>
                    {selectedTask?.title ?? "Standalone Heartbeat"}
                  </h3>
                </div>
                <span
                  className={cn(
                    "rounded-full border px-2 py-1 text-[10px] uppercase tracking-wide",
                    statusClass(selectedRecord.status),
                  )}
                >
                  {selectedRecord.status}
                </span>
              </div>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className={cn("text-xs", mutedClass)}>Owner</dt>
                  <dd className={cn("mt-1", strongClass)}>{ownerLabel}</dd>
                </div>
                <div>
                  <dt className={cn("text-xs", mutedClass)}>Target environment</dt>
                  <dd className={cn("mt-1", strongClass)}>
                    {formatPortfolioHeartbeatEnvironmentLabel(
                      String(selectedRecord.target.environmentId),
                      environmentLabels,
                    )}
                  </dd>
                </div>
                <div>
                  <dt className={cn("text-xs", mutedClass)}>Project</dt>
                  <dd className={cn("mt-1", strongClass)}>
                    {selectedTarget?.projectTitle ?? "Unknown project"}
                  </dd>
                </div>
                <div>
                  <dt className={cn("text-xs", mutedClass)}>Thread</dt>
                  <dd className={cn("mt-1", strongClass)}>
                    {selectedTarget?.threadTitle ?? "Unknown thread"}
                  </dd>
                </div>
                <div>
                  <dt className={cn("text-xs", mutedClass)}>Cadence</dt>
                  <dd className={cn("mt-1", strongClass)}>
                    {formatPortfolioHeartbeatCadence(selectedRecord.cadenceMinutes)}
                  </dd>
                </div>
                <div>
                  <dt className={cn("text-xs", mutedClass)}>Runs</dt>
                  <dd className={cn("mt-1", strongClass)}>
                    {formatPortfolioHeartbeatRuns(selectedRecord)}
                  </dd>
                </div>
                <div>
                  <dt className={cn("text-xs", mutedClass)}>Next delivery</dt>
                  <dd className={cn("mt-1", strongClass)}>
                    {formatPortfolioHeartbeatNextRun(selectedRecord.nextRunAt)}
                  </dd>
                </div>
                <div>
                  <dt className={cn("text-xs", mutedClass)}>Updated</dt>
                  <dd className={cn("mt-1", strongClass)}>
                    {formatPortfolioHeartbeatUpdatedAt(selectedRecord.updatedAt)}
                  </dd>
                </div>
              </dl>
              <div className={cn("mt-4 rounded-lg border p-3 text-xs", blockClass)}>
                <p className={strongClass}>Linked Task</p>
                <p className={cn("mt-1", mutedClass)}>
                  {selectedTask?.title ?? "Standalone Heartbeat"}
                </p>
              </div>
              <div className={cn("mt-4 rounded-lg border p-3", blockClass)}>
                <label
                  className={cn("text-xs font-medium", strongClass)}
                  htmlFor="heartbeat-message"
                >
                  Heartbeat message
                </label>
                <textarea
                  id="heartbeat-message"
                  aria-label="Heartbeat message"
                  className={cn(
                    "mt-2 min-h-28 w-full rounded-md border px-3 py-2 text-sm",
                    isMidnight
                      ? "border-slate-700 bg-slate-950 text-slate-100"
                      : "border-border bg-background",
                  )}
                  placeholder="Message sent on every Heartbeat run. Leave blank to use the Task or standalone fallback."
                  value={messageDraft}
                  onChange={(event) => {
                    setMessageDraft(event.target.value);
                    setMessageSaveState("idle");
                  }}
                />
                <button
                  type="button"
                  className="mt-2 rounded-md bg-sky-500 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
                  disabled={messageSaveState === "saving"}
                  onClick={() => void saveMessage()}
                >
                  {messageSaveState === "saving"
                    ? "Saving…"
                    : messageSaveState === "saved"
                      ? "Saved"
                      : "Save message"}
                </button>
              </div>
              <div className={cn("mt-4 rounded-lg border p-3 text-xs", blockClass)}>
                <p className="font-medium text-emerald-600 dark:text-emerald-300">
                  Latest native receipt
                </p>
                {selectedRecord.lastReceipt ? (
                  <p className={cn("mt-1", mutedClass)}>
                    {selectedRecord.lastReceipt.status} · {selectedRecord.lastReceipt.detail} ·{" "}
                    {selectedRecord.lastReceipt.observedAt}
                  </p>
                ) : (
                  <p className={cn("mt-1", mutedClass)}>No delivery receipt recorded.</p>
                )}
              </div>
              {selectedRecord.pauseReason || selectedRecord.stopReason ? (
                <p className={cn("mt-3 text-xs", mutedClass)}>
                  {selectedRecord.pauseReason ?? selectedRecord.stopReason}
                </p>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-md border border-border px-3 py-2 text-xs font-medium hover:bg-muted/50"
                  onClick={() =>
                    updateStatus(selectedRecord.status === "paused" ? "active" : "paused")
                  }
                >
                  {selectedRecord.status === "paused" ? "Resume" : "Pause"}
                </button>
                <button
                  type="button"
                  className="rounded-md border border-rose-400/40 px-3 py-2 text-xs font-medium text-rose-200 hover:bg-rose-400/10"
                  onClick={() => updateStatus("stopped")}
                >
                  Stop
                </button>
              </div>
            </aside>
          ) : null}
        </div>
      )}
    </div>
  );
}

function NativeAgentMessagingView({ setMode }: { setMode: ModeSetter }) {
  const navigate = useNavigate();
  const { environments } = useEnvironments();
  const projects = useProjects();
  const threads = useThreadShells();
  const startThreadTurn = useAtomCommand(threadEnvironment.startTurn, { reportFailure: false });
  const targets = useMemo(
    () => buildNativeHeartbeatTargets(projects, threads),
    [projects, threads],
  );
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [sendState, setSendState] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const [sendDetail, setSendDetail] = useState<string | null>(null);
  const selectedTarget = targets.find((target) => target.key === selectedKey) ?? targets[0] ?? null;
  const selectedThread = useThread(
    selectedTarget
      ? {
          environmentId: selectedTarget.environmentId,
          threadId: selectedTarget.threadId,
        }
      : null,
  );
  const environmentById = useMemo(
    () =>
      new Map(environments.map((environment) => [String(environment.environmentId), environment])),
    [environments],
  );
  const canSend =
    selectedTarget !== null &&
    selectedThread !== null &&
    selectedThread.id === selectedTarget.threadId &&
    selectedThread.environmentId === selectedTarget.environmentId &&
    selectedThread.projectId === selectedTarget.projectId;

  const sendMessage = async () => {
    const text = message.trim();
    if (!canSend || !selectedTarget || !selectedThread || !text || sendState === "sending") return;

    setSendState("sending");
    setSendDetail(null);
    const commandId = newCommandId();
    const result = await startThreadTurn({
      environmentId: selectedTarget.environmentId,
      input: {
        commandId,
        threadId: selectedTarget.threadId,
        message: {
          messageId: newMessageId(),
          role: "user",
          text,
          attachments: [],
        },
        modelSelection: selectedThread.modelSelection,
        runtimeMode: selectedThread.runtimeMode,
        interactionMode: selectedThread.interactionMode,
        createdAt: new Date().toISOString(),
      },
    });
    if (result._tag === "Success") {
      setMessage("");
      setSendState("sent");
      setSendDetail(
        `Native turn accepted (sequence ${result.value.sequence}, command ${commandId}).`,
      );
    } else {
      setSendState("failed");
      setSendDetail(nativeDispatchFailureDetail(result));
    }
  };

  return (
    <section className="mt-8 space-y-4" aria-label="Native agent messaging">
      <div className="rounded-xl border border-violet-400/20 bg-violet-400/5 p-5">
        <h2 className="font-medium">Message a native T3 agent</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Select an exact environment, project, and thread, then send one ordinary native T3 turn.
          This uses the existing connection supervisor and `thread.turn.start`; it does not route
          through VoiceTools or create a second message store.
        </p>
      </div>
      {targets.length === 0 ? (
        <div className="rounded-xl border border-border/70 bg-card/30 p-5 text-sm text-muted-foreground">
          No native T3 threads are available yet. Add or connect an environment, then open its
          Agents list once the shell snapshot is ready.
        </div>
      ) : (
        <>
          <div className="grid gap-2" aria-label="Native agent targets">
            {targets.slice(0, 20).map((target) => {
              const environment = environmentById.get(String(target.environmentId));
              const isSelected = selectedTarget?.key === target.key;
              return (
                <button
                  key={target.key}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => {
                    setSelectedKey(target.key);
                    setSendState("idle");
                    setSendDetail(null);
                  }}
                  className={cn(
                    "rounded-xl border p-4 text-left transition-colors",
                    isSelected
                      ? "border-violet-400/50 bg-violet-400/10"
                      : "border-border/70 bg-card/30 hover:bg-muted/30",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-medium">{target.threadTitle}</h3>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {target.projectTitle} · {environment?.label ?? target.environmentId}
                      </p>
                    </div>
                    <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {environment?.connection.phase ?? "unavailable"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
          {targets.length > 20 ? (
            <p className="text-xs text-muted-foreground">
              Showing the 20 most recently active native threads.
            </p>
          ) : null}
          {selectedTarget ? (
            <div className="rounded-xl border border-border/70 bg-card/30 p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-medium">{selectedTarget.threadTitle}</h3>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {selectedTarget.environmentId}
                </span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Target identity: {selectedTarget.environmentId} / {selectedTarget.projectId} /{" "}
                {selectedTarget.threadId}
              </p>
              <textarea
                className="mt-4 min-h-24 w-full rounded-md border border-border bg-background/50 p-3 text-sm outline-none placeholder:text-muted-foreground focus:border-violet-400"
                aria-label="Message selected native agent"
                placeholder="Message this agent…"
                value={message}
                onChange={(event) => {
                  setMessage(event.target.value);
                  if (sendState !== "idle") setSendState("idle");
                }}
                disabled={sendState === "sending"}
              />
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className="rounded-md bg-violet-500 px-3 py-2 text-xs font-medium text-white hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!canSend || message.trim().length === 0 || sendState === "sending"}
                  onClick={() => void sendMessage()}
                >
                  {sendState === "sending" ? "Sending…" : "Send native message"}
                </button>
                <button
                  type="button"
                  className="rounded-md border border-border px-3 py-2 text-xs font-medium hover:bg-muted/50"
                  onClick={() => {
                    setMode(null);
                    void navigate({
                      to: "/$environmentId/$threadId",
                      params: {
                        environmentId: selectedTarget.environmentId,
                        threadId: selectedTarget.threadId,
                      },
                    });
                  }}
                >
                  Open native thread
                </button>
                {sendDetail ? (
                  <span className="text-xs text-muted-foreground" role="status">
                    {sendDetail}
                  </span>
                ) : null}
              </div>
              {!canSend ? (
                <p className="mt-3 text-[11px] text-muted-foreground/70">
                  Waiting for the selected native thread detail before enabling dispatch.
                </p>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

function NativeEnvironmentInventoryView() {
  const { environments, isReady } = useEnvironments();

  return (
    <section className="mt-8 space-y-4" aria-label="Native environment inventory">
      <div className="rounded-xl border border-border/70 bg-card/30 p-5">
        <h2 className="font-medium">Native environment readiness</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          This is the T3 connection inventory used by Portfolio messaging and Heartbeat reads. It
          reports only native connection metadata; VoiceTools host health and peer diagnostics are
          not substituted here.
        </p>
      </div>
      {!isReady ? (
        <div className="rounded-xl border border-border/70 bg-card/30 p-5 text-sm text-muted-foreground">
          Loading native environment registrations…
        </div>
      ) : environments.length === 0 ? (
        <div className="rounded-xl border border-border/70 bg-card/30 p-5 text-sm text-muted-foreground">
          No native environments are registered. Add a machine through T3 Connections before it can
          appear as a Portfolio target.
        </div>
      ) : (
        <div className="grid gap-3">
          {environments.map((environment) => {
            const descriptor = environment.serverConfig?.environment;
            const heartbeatOwnerCapability = descriptor?.capabilities.portfolioHeartbeatOwner;
            const target = environment.entry.target;
            return (
              <article
                key={String(environment.environmentId)}
                className="rounded-xl border border-border/70 bg-card/30 p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-medium">{environment.label}</h3>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {environment.environmentId}
                    </p>
                  </div>
                  <span className="rounded-full border border-border px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {environment.connection.phase}
                  </span>
                </div>
                <dl className="mt-4 grid gap-3 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <dt>Connection target</dt>
                    <dd className="mt-1 text-foreground">{target._tag}</dd>
                  </div>
                  <div>
                    <dt>Platform</dt>
                    <dd className="mt-1 text-foreground">
                      {descriptor
                        ? `${descriptor.platform.os} · ${descriptor.platform.arch}`
                        : "unknown"}
                    </dd>
                  </div>
                  <div>
                    <dt>Server</dt>
                    <dd className="mt-1 text-foreground">
                      {descriptor?.serverVersion ?? "unknown"}
                    </dd>
                  </div>
                  <div>
                    <dt>Heartbeat owner API</dt>
                    <dd className="mt-1 text-foreground">
                      {heartbeatOwnerCapability === true
                        ? "advertised"
                        : descriptor
                          ? "not advertised"
                          : "not read yet"}
                    </dd>
                  </div>
                </dl>
                <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground/70">
                  {environment.connection.phase === "connected"
                    ? "Native Portfolio rows can target this environment when its project/thread shell is synchronized."
                    : "Native messaging and Heartbeat reads remain unavailable until this connection is ready."}
                </p>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function RotationView({
  rows,
  grouping,
  sort,
  onSortChange,
  onGroupingChange,
  selectedKey,
  onSelect,
  onOpen,
  onDispatch,
  onRequestRotation,
}: {
  rows: ReadonlyArray<ReturnType<typeof buildPortfolioRotationRows>[number]>;
  grouping: PortfolioRotationGrouping;
  sort: PortfolioRotationSort;
  onSortChange: (sort: PortfolioRotationSort) => void;
  onGroupingChange: (grouping: PortfolioRotationGrouping) => void;
  selectedKey: string | null;
  onSelect: (key: string) => void;
  onOpen: (row: ReturnType<typeof buildPortfolioRotationRows>[number]) => void;
  onDispatch: (text: string) => Promise<{ ok: boolean; detail: string }>;
  onRequestRotation: (
    row: ReturnType<typeof buildPortfolioRotationRows>[number],
  ) => Promise<{ ok: boolean; detail: string }>;
}) {
  const selected = rows.find((row) => row.key === selectedKey) ?? rows[0] ?? null;
  const authority = selected ? resolvePortfolioRotationAuthority(selected) : null;
  const groups = groupPortfolioRotationRows(rows.slice(0, 20), grouping);
  const [dispatchText, setDispatchText] = useState("");
  const [dispatchBusy, setDispatchBusy] = useState(false);
  const [dispatchDetail, setDispatchDetail] = useState<string | null>(null);
  const [reviewedRotationKey, setReviewedRotationKey] = useState<string | null>(null);
  const [rotationRequestBusy, setRotationRequestBusy] = useState(false);
  const [rotationRequestDetail, setRotationRequestDetail] = useState<string | null>(null);

  const submitDispatch = async () => {
    const text = dispatchText.trim();
    if (!text || dispatchBusy) return;
    setDispatchBusy(true);
    setDispatchDetail(null);
    try {
      const result = await onDispatch(text);
      setDispatchDetail(result.detail);
      if (result.ok) setDispatchText("");
    } catch {
      setDispatchDetail("The native dispatch could not be completed.");
    } finally {
      setDispatchBusy(false);
    }
  };

  const submitReviewedRotation = async () => {
    if (!selected || reviewedRotationKey !== selected.key || rotationRequestBusy) return;
    setRotationRequestBusy(true);
    setRotationRequestDetail(null);
    try {
      const result = await onRequestRotation(selected);
      setRotationRequestDetail(result.detail);
    } catch {
      setRotationRequestDetail("The reviewed native Rotate request could not be completed.");
    } finally {
      setRotationRequestBusy(false);
    }
  };

  return (
    <section className="mt-8 space-y-3" aria-label="Portfolio rotations">
      <div className="rounded-xl border border-violet-400/20 bg-violet-400/5 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-medium">Native rotation health</h2>
          <span className="rounded-full border border-border px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
            Read-only
          </span>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Rows come from native T3 project/thread shells. Missing telemetry, role records, and
          standards links stay unavailable rather than being inferred.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Sort</span>
          <Select
            modal={false}
            value={sort}
            onValueChange={(value) => {
              if (value) onSortChange(value as PortfolioRotationSort);
            }}
          >
            <SelectTrigger size="sm" className="w-40" aria-label="Sort rotations">
              <SelectValue>
                {PORTFOLIO_ROTATION_SORT_OPTIONS.find((option) => option.value === sort)?.label}
              </SelectValue>
            </SelectTrigger>
            <SelectPopup align="start" alignItemWithTrigger={false}>
              {PORTFOLIO_ROTATION_SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} hideIndicator value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
          <span className="ml-2 text-xs text-muted-foreground">Group</span>
          <Select
            modal={false}
            value={grouping}
            onValueChange={(value) => {
              if (value) onGroupingChange(value as PortfolioRotationGrouping);
            }}
          >
            <SelectTrigger size="sm" className="w-40" aria-label="Group rotations">
              <SelectValue>
                {
                  PORTFOLIO_ROTATION_GROUPING_OPTIONS.find((option) => option.value === grouping)
                    ?.label
                }
              </SelectValue>
            </SelectTrigger>
            <SelectPopup align="start" alignItemWithTrigger={false}>
              {PORTFOLIO_ROTATION_GROUPING_OPTIONS.map((option) => (
                <SelectItem key={option.value} hideIndicator value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="rounded-xl border border-border/70 bg-card/30 p-5 text-sm text-muted-foreground">
          No native T3 threads are available yet.
        </div>
      ) : (
        groups.map((group) => (
          <div key={group.key} className="space-y-3">
            {grouping !== "none" ? (
              <h2 className="px-1 pt-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {group.label}
              </h2>
            ) : null}
            {group.rows.map((row) => (
              <button
                key={row.key}
                type="button"
                aria-pressed={row.key === selected?.key}
                onClick={() => onSelect(row.key)}
                className={cn(
                  "w-full rounded-xl border p-4 text-left transition-colors",
                  row.key === selected?.key
                    ? "border-violet-400/50 bg-violet-400/10"
                    : "border-border/70 bg-card/30 hover:bg-muted/30",
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="truncate font-medium">{row.sessionTitle}</h2>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {row.projectTitle} · {row.hostLabel} ·{" "}
                      {row.platform ?? "platform unavailable"}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-border px-2 py-1 text-[10px] font-medium uppercase tracking-wide">
                    {row.rotationState}
                  </span>
                </div>
                <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-6">
                  <span>Connection: {row.connectionStatus?.phase ?? "unavailable"}</span>
                  <span>Server: {row.serverVersion ?? "unknown"}</span>
                  <span>
                    Context:{" "}
                    {row.telemetry
                      ? formatContextWindowTokens(row.telemetry.usedTokens)
                      : "unavailable"}
                  </span>
                  <span>
                    Processed:{" "}
                    {formatContextWindowTokens(row.telemetry?.totalProcessedTokens ?? null)}
                  </span>
                  <span>Telemetry: {row.telemetryFreshness}</span>
                  <span>Worker: {row.worker ?? "unavailable"}</span>
                </div>
              </button>
            ))}
          </div>
        ))
      )}
      {rows.length > 20 ? (
        <p className="text-xs text-muted-foreground">
          Showing the 20 most relevant native threads.
        </p>
      ) : null}
      {selected ? (
        <div
          className="rounded-xl border border-sky-400/20 bg-sky-400/5 p-5"
          aria-label="Rotation detail"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-medium">Rotation review preview</h2>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {selected.promptPreviewVersion}
            </span>
          </div>
          <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Reason</dt>
              <dd className="mt-1">{selected.rotationReason}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Last rotation</dt>
              <dd className="mt-1">{selected.lastRotationAt ?? "unavailable"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Worker / role</dt>
              <dd className="mt-1">
                {authority?.workerIdentity.worker ?? "unavailable"} ·{" "}
                {authority?.roleAvailability.role ?? "unavailable"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Standards</dt>
              <dd className="mt-1">
                {authority && authority.standards.length > 0
                  ? authority.standards.length
                  : "unavailable"}
              </dd>
            </div>
          </dl>
          <pre className="mt-4 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-border/60 bg-background/40 p-3 text-xs leading-relaxed text-muted-foreground">
            {selected.promptPreview}
          </pre>
          <p className="mt-3 text-[11px] text-muted-foreground/70">
            The reviewed request sends one bounded native turn to this exact target. It does not
            automatically create, rename, archive, hand off, cut over, schedule, or dispatch a
            follow-up agent action.
          </p>
          <p className="mt-2 text-[11px] text-muted-foreground/70">
            Authority: {authority?.promptPreviewVersion ?? "unavailable"} · Rotate, successor,
            rename, archive, handoff, and cutover remain disabled.
          </p>
          {authority && authority.standards.length > 0 ? (
            <ul className="mt-2 space-y-1 text-[11px] text-muted-foreground/70">
              {authority.standards.map((standard) => (
                <li key={`${standard.label}:${standard.path}`}>
                  {standard.label}: {standard.path}@{standard.revision ?? "unknown"}
                </li>
              ))}
            </ul>
          ) : null}
          <div
            className="mt-4 rounded-lg border border-amber-400/20 bg-amber-400/5 p-3"
            aria-label="Reviewed native Rotate request"
          >
            <label className="flex items-start gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                className="mt-0.5 accent-amber-400"
                checked={reviewedRotationKey === selected.key}
                onChange={(event) => {
                  setReviewedRotationKey(event.target.checked ? selected.key : null);
                  setRotationRequestDetail(null);
                }}
                disabled={rotationRequestBusy}
              />
              <span>
                I reviewed this exact environment/project/thread target, the rotation reason, and
                the unavailable metadata. Send one bounded native Rotate request only.
              </span>
            </label>
            <button
              type="button"
              className="mt-3 rounded-md border border-amber-300/40 px-3 py-2 text-xs font-medium text-amber-100 hover:bg-amber-300/10 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={rotationRequestBusy || reviewedRotationKey !== selected.key}
              onClick={() => void submitReviewedRotation()}
            >
              {rotationRequestBusy ? "Requestingâ€¦" : "Send reviewed Rotate request"}
            </button>
            {rotationRequestDetail ? (
              <p className="mt-2 text-[11px] text-muted-foreground" role="status">
                {rotationRequestDetail}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className="mt-4 rounded-md border border-border px-3 py-2 text-xs font-medium hover:bg-muted/50"
            onClick={() => onOpen(selected)}
          >
            Open native thread
          </button>
          <div className="mt-5 border-t border-border/60 pt-4" aria-label="Native message dispatch">
            <h3 className="text-sm font-medium">Send native message</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Sends one ordinary T3 turn to this exact environment and thread. No VoiceTools
              transport or automatic follow-up is used.
            </p>
            <textarea
              className="mt-3 min-h-20 w-full rounded-md border border-border bg-background/50 p-3 text-sm outline-none placeholder:text-muted-foreground focus:border-violet-400"
              aria-label="Native message"
              placeholder="Message this agent…"
              value={dispatchText}
              onChange={(event) => setDispatchText(event.target.value)}
              disabled={dispatchBusy}
            />
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                className="rounded-md bg-violet-500 px-3 py-2 text-xs font-medium text-white hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={dispatchBusy || dispatchText.trim().length === 0}
                onClick={() => void submitDispatch()}
              >
                {dispatchBusy ? "Sending…" : "Send native message"}
              </button>
              {dispatchDetail ? (
                <span className="text-xs text-muted-foreground" role="status">
                  {dispatchDetail}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function HeartbeatOwnerCard({
  owner,
  isPending,
  canClaim,
  onClaim,
}: {
  owner: ReturnType<typeof normalizeHeartbeatOwnerState>;
  isPending: boolean;
  canClaim: boolean;
  onClaim: (
    input: Omit<PortfolioHeartbeatOwnerClaimRequest, "target">,
  ) => Promise<{ ok: boolean; detail: string }>;
}) {
  const [portfolioRevision, setPortfolioRevision] = useState("");
  const [heartbeatRevision, setHeartbeatRevision] = useState("");
  const [portfolioChecksum, setPortfolioChecksum] = useState("");
  const [heartbeatChecksum, setHeartbeatChecksum] = useState("");
  const [claimState, setClaimState] = useState<"idle" | "claiming" | "claimed" | "failed">("idle");
  const [claimDetail, setClaimDetail] = useState<string | null>(null);

  const claim = async () => {
    const portfolioRevisionValue = Number.parseInt(portfolioRevision.trim(), 10);
    const heartbeatRevisionValue = Number.parseInt(heartbeatRevision.trim(), 10);
    if (
      !canClaim ||
      claimState === "claiming" ||
      !Number.isSafeInteger(portfolioRevisionValue) ||
      portfolioRevisionValue < 0 ||
      !Number.isSafeInteger(heartbeatRevisionValue) ||
      heartbeatRevisionValue < 0 ||
      portfolioChecksum.trim().length === 0 ||
      heartbeatChecksum.trim().length === 0
    ) {
      setClaimState("failed");
      setClaimDetail(
        "Enter non-negative Portfolio and Heartbeat revisions plus both authoritative checksums.",
      );
      return;
    }

    setClaimState("claiming");
    setClaimDetail(null);
    const result = await onClaim({
      portfolioRevision: portfolioRevisionValue,
      heartbeatRevision: heartbeatRevisionValue,
      portfolioChecksum: portfolioChecksum.trim(),
      heartbeatChecksum: heartbeatChecksum.trim(),
    });
    setClaimState(result.ok ? "claimed" : "failed");
    setClaimDetail(result.detail);
  };

  return (
    <div className="mt-5 border-t border-sky-400/15 pt-4" aria-label="Heartbeat owner status">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium">Native T3 Heartbeat owner</h3>
        <span className="rounded-full border border-amber-400/30 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-amber-300">
          {isPending ? "Reading…" : heartbeatOwnerRoleLabel(owner.role)}
        </span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        This is a read-only owner report from the selected native T3 environment. It does not
        schedule or transfer Heartbeats; the separate proof card only permits one bounded dispatch
        when this environment is the fresh owner.
      </p>
      <p className="mt-2 text-[11px] text-muted-foreground/70">
        {owner.descriptor
          ? `Reported owner ${owner.descriptor.ownerEnvironmentId ?? owner.descriptor.ownerHostId ?? "unknown"}; epoch ${owner.descriptor.ownerEpoch ?? "unknown"}; freshness ${owner.freshness}.`
          : "No native owner descriptor is available yet; Heartbeats remain paused."}
      </p>
      {!owner.descriptor || owner.role !== "owner" ? (
        <div className="mt-4 rounded-lg border border-border/60 bg-background/30 p-3">
          <p className="text-xs font-medium text-foreground">Explicit owner initialization</p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            Claiming writes the selected target and supplied revision/checksum values to this
            environment. T3 will not derive or invent them. Use the authoritative Portfolio and
            Heartbeat records, then claim once; a conflicting owner remains rejected.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className="text-[11px] text-muted-foreground">
              Portfolio revision
              <input
                inputMode="numeric"
                value={portfolioRevision}
                onChange={(event) => setPortfolioRevision(event.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background/50 px-2 py-1.5 text-xs text-foreground outline-none focus:border-sky-400"
                placeholder="e.g. 12"
                disabled={!canClaim || claimState === "claiming"}
              />
            </label>
            <label className="text-[11px] text-muted-foreground">
              Heartbeat revision
              <input
                inputMode="numeric"
                value={heartbeatRevision}
                onChange={(event) => setHeartbeatRevision(event.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background/50 px-2 py-1.5 text-xs text-foreground outline-none focus:border-sky-400"
                placeholder="e.g. 4"
                disabled={!canClaim || claimState === "claiming"}
              />
            </label>
            <label className="text-[11px] text-muted-foreground">
              Portfolio checksum
              <input
                value={portfolioChecksum}
                onChange={(event) => setPortfolioChecksum(event.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background/50 px-2 py-1.5 text-xs text-foreground outline-none focus:border-sky-400"
                placeholder="authoritative checksum"
                disabled={!canClaim || claimState === "claiming"}
              />
            </label>
            <label className="text-[11px] text-muted-foreground">
              Heartbeat checksum
              <input
                value={heartbeatChecksum}
                onChange={(event) => setHeartbeatChecksum(event.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background/50 px-2 py-1.5 text-xs text-foreground outline-none focus:border-sky-400"
                placeholder="authoritative checksum"
                disabled={!canClaim || claimState === "claiming"}
              />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="rounded-md border border-sky-400/40 px-3 py-2 text-xs font-medium text-sky-200 hover:bg-sky-400/10 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!canClaim || claimState === "claiming"}
              onClick={() => void claim()}
            >
              {claimState === "claiming" ? "Claiming…" : "Claim this environment as owner"}
            </button>
            {claimDetail ? (
              <span className="text-[11px] text-muted-foreground" role="status">
                {claimDetail}
              </span>
            ) : null}
          </div>
          {!canClaim ? (
            <p className="mt-2 text-[11px] text-muted-foreground/70">
              This server does not advertise the native Heartbeat owner endpoint; connect to a newer
              T3 environment before claiming.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function HeartbeatTransferPreviewCard({
  preview,
  sourceEnvironmentId,
  targetEnvironmentId,
  isPending,
}: {
  preview: ReturnType<typeof buildPortfolioHeartbeatOwnerTransferPreview>;
  sourceEnvironmentId: string | null;
  targetEnvironmentId: string | null;
  isPending: boolean;
}) {
  return (
    <div
      className="mt-5 border-t border-sky-400/15 pt-4"
      aria-label="Heartbeat owner transfer preview"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium">Owner transfer preview</h3>
        <span className="rounded-full border border-border px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {isPending ? "Reading…" : "Preview only"}
        </span>
      </div>
      <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
        <p>Source: {sourceEnvironmentId ?? "unavailable"}</p>
        <p>Target: {targetEnvironmentId ?? "unavailable"}</p>
        <p>Source role: {preview.oldOwnerRole}</p>
        <p>Target role: {preview.newOwnerRole}</p>
        <p>Epoch: {preview.ownerEpoch ?? "unavailable"}</p>
        <p>Receipt: {preview.receiptStatus}</p>
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground/70">
        {preview.receiptDetail} Revision continuity: portfolio{" "}
        {String(preview.revisionContinuity.portfolio)}, heartbeat{" "}
        {String(preview.revisionContinuity.heartbeat)}. Checksum continuity: portfolio{" "}
        {String(preview.checksumContinuity.portfolio)}, heartbeat{" "}
        {String(preview.checksumContinuity.heartbeat)}.
      </p>
      <p className="mt-2 text-[11px] text-muted-foreground/70">
        Transfer is disabled. Heartbeats must be paused and the target must be registered before a
        live owner handoff can be considered.
      </p>
    </div>
  );
}

function HeartbeatDraftCard({
  draft,
  proof,
  canDispatch,
  onDispatch,
  onConfirm,
}: {
  draft: ReturnType<typeof buildPausedNativeHeartbeatDraft>;
  proof: HeartbeatProofState | null;
  canDispatch: boolean;
  onDispatch: () => void;
  onConfirm: () => void;
}) {
  const proofReceipt = proof?.receipt;
  const proofStatus = proofReceipt?.status ?? draft.status;
  const proofInFlight = proof?.busy === true;
  const canConfirm = proofReceipt?.status === "dispatched" && proof?.runId != null;
  return (
    <div
      className="mt-5 border-t border-sky-400/15 pt-4"
      aria-label="Heartbeat draft configuration"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium">Heartbeat configuration</h3>
        <span className="rounded-full border border-border px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {proofStatus}
        </span>
      </div>
      <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
        <p>Cadence: not configured</p>
        <p>Run limit: not configured</p>
        <p>Expiry: not configured</p>
        <p>Finish line: not configured</p>
        <p>
          Lifecycle: {proof?.lifecycle.state ?? draft.lifecycle.state} · runs{" "}
          {proof?.lifecycle.runCount ?? draft.lifecycle.runCount}
        </p>
        <p>Allowed actions: {canDispatch ? "one bounded proof" : "owner claim required"}</p>
        <p>Receipt owner: {draft.receiptOwner}</p>
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground/70">
        Stop conditions in the future contract: {draft.stopConditions.join(" · ")}. This proof sends
        at most one native turn; it does not save settings or start a schedule.
      </p>
      {proofReceipt ? (
        <p className="mt-2 text-[11px] text-muted-foreground/70" role="status">
          {proofReceipt.detail}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded-md bg-sky-500 px-3 py-2 text-xs font-medium text-white hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!canDispatch || proofInFlight || proof?.lifecycle.activeRunId != null}
          onClick={onDispatch}
        >
          {proofInFlight ? "Dispatching…" : "Run one bounded proof"}
        </button>
        <button
          type="button"
          className="rounded-md border border-border px-3 py-2 text-xs font-medium hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!canConfirm}
          onClick={onConfirm}
        >
          Confirm transcript complete
        </button>
      </div>
      {!canDispatch ? (
        <p className="mt-2 text-[11px] text-muted-foreground/70">
          Dispatch is disabled until this environment has a fresh native Heartbeat owner claim.
        </p>
      ) : null}
    </div>
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
  const [selectedWorkflowId, setSelectedWorkflowId] = useState(PORTFOLIO_WORKFLOWS[0]?.id ?? null);
  const selectedWorkflow =
    PORTFOLIO_WORKFLOWS.find((workflow) => workflow.id === selectedWorkflowId) ??
    PORTFOLIO_WORKFLOWS[0] ??
    null;

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
        {PORTFOLIO_WORKFLOWS.map((workflow) => (
          <button
            key={workflow.title}
            type="button"
            aria-pressed={selectedWorkflow?.id === workflow.id}
            onClick={() => setSelectedWorkflowId(workflow.id)}
            className="rounded-xl border border-border/70 bg-card/30 p-4"
          >
            <div className="flex items-start gap-3">
              <WrenchIcon className="mt-0.5 size-4 shrink-0 text-sky-500 dark:text-sky-300" />
              <div className="min-w-0">
                <h2 className="font-medium">{workflow.title}</h2>
                <p className="mt-2 text-left text-sm leading-relaxed text-muted-foreground">
                  {workflow.purpose}
                </p>
                <p className="mt-3 text-left text-[11px] uppercase tracking-wide text-muted-foreground/70">
                  {workflow.source}
                </p>
              </div>
            </div>
          </button>
        ))}
      </section>
      {selectedWorkflow ? <WorkflowDetail workflow={selectedWorkflow} /> : null}
    </>
  );
}

function formatStorageBytes(bytes: number): string {
  if (bytes < 1024) return String(bytes) + " B";
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return value.toFixed(value >= 10 ? 0 : 1) + " " + units[unitIndex];
}

function storageEntryAge(entry: StorageInventoryEntry): string {
  return entry.latestModifiedAt === null
    ? "No files observed"
    : "Last changed " + new Date(entry.latestModifiedAt).toLocaleString();
}

function StorageCategoryCard({
  title,
  entries,
}: {
  title: string;
  entries: readonly StorageInventoryEntry[];
}) {
  const bytes = entries.reduce((total, entry) => total + entry.bytes, 0);
  return (
    <div className="rounded-lg border border-border/60 bg-background/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-medium">{title}</h3>
        <span className="text-xs text-muted-foreground">{formatStorageBytes(bytes)}</span>
      </div>
      {entries.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">No bounded roots reported.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {entries.map((entry) => (
            <li key={entry.label + entry.path} className="rounded-md border border-border/50 p-3">
              <div className="flex items-start justify-between gap-3 text-sm">
                <span className="min-w-0 font-medium">{entry.label}</span>
                <span className="shrink-0 text-muted-foreground">
                  {formatStorageBytes(entry.bytes)}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {entry.fileCount} files · {storageEntryAge(entry)}
              </p>
              <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground/80">
                {entry.state}
                {entry.message ? " · " + entry.message : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StorageFootprintPreview() {
  const inventory = useStorageInventory();
  return (
    <section
      className="mt-8 rounded-xl border border-border/70 bg-card/30 p-5"
      aria-label="Storage inventory status"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-medium">Storage footprint</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Read-only host-owned measurements from fixed, authenticated environment roots.
          </p>
        </div>
        <button
          type="button"
          className="rounded-md border border-border px-3 py-2 text-xs font-medium hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={inventory.refresh}
          disabled={inventory.isPending}
        >
          {inventory.isPending ? "Reading…" : "Refresh"}
        </button>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Context health is token telemetry, not storage. Transcript footprint and database footprint
        are measured separately; this view does not infer one from the other.
      </p>
      {inventory.environments.length === 0 ? (
        <p className="mt-4 rounded-md border border-border/60 px-3 py-3 text-sm text-muted-foreground">
          No connected environments are available for an authenticated inventory read.
        </p>
      ) : (
        <div className="mt-4 space-y-5">
          {inventory.environments.map((environment) => {
            if (environment.inventory === null) {
              return (
                <div
                  key={String(environment.environmentId)}
                  className="rounded-lg border border-border/60 p-4"
                >
                  <h3 className="font-medium">{environment.label}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {environment.isPending
                      ? "Reading bounded roots…"
                      : (environment.error ?? "No inventory response.")}
                  </p>
                </div>
              );
            }
            const entries = environment.inventory.entries;
            const transcripts = entries.filter((entry) => entry.category === "transcripts");
            const database = entries.filter((entry) => entry.category === "database");
            const other = entries.filter(
              (entry) => entry.category !== "transcripts" && entry.category !== "database",
            );
            return (
              <div key={String(environment.environmentId)} className="space-y-3">
                <div>
                  <h3 className="font-medium">{environment.label}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Read at {new Date(environment.inventory.readAt).toLocaleString()}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <StorageCategoryCard title="Transcript footprint" entries={transcripts} />
                  <StorageCategoryCard title="Database footprint" entries={database} />
                </div>
                <StorageCategoryCard title="Other bounded roots" entries={other} />
              </div>
            );
          })}
        </div>
      )}
      <p className="mt-4 text-xs leading-relaxed text-muted-foreground/80">
        No cleanup, deletion, archive, compaction, VACUUM, direct database mutation, or Heartbeat
        scheduling is connected to this read.
      </p>
    </section>
  );
}

function WorkflowDetail({ workflow }: { workflow: PortfolioWorkflow }) {
  return (
    <section
      className="mt-3 rounded-xl border border-sky-400/20 bg-sky-400/5 p-5"
      aria-label="Selected workflow"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-300">
        Selected workflow
      </p>
      <h2 className="mt-1 font-medium">{workflow.title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Use when: {workflow.whenToUse}
      </p>
      <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
        <WorkflowList title="Inputs" items={workflow.inputs} />
        <WorkflowList title="Permitted actions" items={workflow.permittedActions} />
        <WorkflowList title="Stop conditions" items={workflow.stopConditions} />
        <WorkflowList title="Evidence / receipt" items={workflow.evidence} />
      </div>
      <p className="mt-4 text-xs text-muted-foreground/80">Source: {workflow.source}</p>
    </section>
  );
}

function WorkflowList({ title, items }: { title: string; items: ReadonlyArray<string> }) {
  return (
    <div>
      <h3 className="font-medium">{title}</h3>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function WishlistPreview({
  wishlists,
  isPending,
  targets,
  onCreate,
  onPromote,
}: {
  readonly wishlists: ReadonlyArray<PortfolioWishlist>;
  readonly isPending: boolean;
  readonly targets: ReadonlyArray<NativeHeartbeatTarget>;
  readonly onCreate: (input: {
    readonly title: string;
    readonly summary: string;
    readonly priority: string;
  }) => Promise<void>;
  readonly onPromote: (input: {
    readonly wishlist: PortfolioWishlist;
    readonly target: NativeHeartbeatTarget;
  }) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [priority] = useState("normal");
  const [selectedTargetKey, setSelectedTargetKey] = useState<string | null>(null);
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const selectedTarget = targets.find((target) => target.key === selectedTargetKey) ?? null;
  return (
    <section className="mt-8 rounded-xl border border-amber-400/20 bg-amber-400/5 p-5">
      <h2 className="font-medium">Wishlist</h2>
      <div className="mt-4 grid gap-2">
        <input
          aria-label="Wishlist title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Title"
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        <textarea
          aria-label="Wishlist summary"
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          placeholder="What should become useful?"
          className="min-h-20 rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        <button
          type="button"
          disabled={title.trim() === "" || summary.trim() === ""}
          onClick={() => {
            void onCreate({ title: title.trim(), summary: summary.trim(), priority });
            setTitle("");
            setSummary("");
          }}
          className="w-fit rounded-md border border-amber-400/40 px-3 py-2 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
        >
          Save Wishlist item
        </button>
      </div>
      <div className="mt-6 space-y-3">
        {isPending ? <p className="text-sm text-muted-foreground">Loading Wishlist…</p> : null}
        {wishlists.length === 0 && !isPending ? (
          <p className="text-sm text-muted-foreground">No Wishlist items yet.</p>
        ) : null}
        {wishlists.map((wishlist) => (
          <article
            key={wishlist.wishlistId}
            className="rounded-lg border border-border/60 bg-background/30 p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-medium">{wishlist.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{wishlist.summary}</p>
              </div>
              <span className="text-xs text-muted-foreground">{wishlist.status}</span>
            </div>
            {wishlist.promotedTaskId === null ? (
              <div className="mt-3 grid gap-2">
                <select
                  aria-label={`Target for ${wishlist.title}`}
                  value={selectedTarget?.key ?? ""}
                  onChange={(event) => setSelectedTargetKey(event.target.value || null)}
                  className="rounded-md border border-border bg-background px-2 py-2 text-xs"
                >
                  <option value="">Select exact environment, project, and thread</option>
                  {targets.map((target) => (
                    <option key={target.key} value={target.key}>
                      {target.environmentId} / {target.projectTitle} / {target.threadTitle}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={selectedTarget === null || promotingId !== null}
                  onClick={() => {
                    if (!selectedTarget) return;
                    setPromotingId(wishlist.wishlistId);
                    void onPromote({ wishlist, target: selectedTarget }).finally(() =>
                      setPromotingId(null),
                    );
                  }}
                  className="w-fit rounded-md border border-amber-400/40 px-3 py-2 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {promotingId === wishlist.wishlistId ? "Promoting…" : "Promote to Task"}
                </button>
              </div>
            ) : (
              <p className="mt-3 text-xs text-emerald-300">
                Promoted to Task {wishlist.promotedTaskId}
              </p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function TasksList({
  tasks,
  isPending,
  targets,
  heartbeats,
  environmentLabels,
  onCreateTask,
  onDispatchTask,
  onStatusChange,
  onHeartbeatUpsert,
}: {
  readonly tasks: ReadonlyArray<PortfolioTask>;
  readonly isPending: boolean;
  readonly targets: ReadonlyArray<NativeHeartbeatTarget>;
  readonly heartbeats: ReadonlyArray<PortfolioHeartbeatRecord>;
  readonly environmentLabels: ReadonlyMap<string, string>;
  readonly onCreateTask: (input: {
    readonly title: string;
    readonly outcome: string;
    readonly priority: string;
    readonly status: PortfolioTaskStatus;
    readonly completionCondition: string;
    readonly checklistItems: PortfolioTask["checklistItems"];
    readonly target: NativeHeartbeatTarget;
    readonly heartbeat: {
      readonly enabled: boolean;
      readonly cadenceMinutes: number | null;
      readonly maxRuns: number | null;
      readonly message: string | null;
    } | null;
  }) => Promise<void>;
  readonly onDispatchTask: (task: PortfolioTask) => Promise<void>;
  readonly onStatusChange: (task: PortfolioTask, status: PortfolioTaskStatus) => void;
  readonly onHeartbeatUpsert: (record: PortfolioHeartbeatRecord) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [outcome, setOutcome] = useState("");
  const [priority, setPriority] = useState("normal");
  const [status, setStatus] = useState<PortfolioTaskStatus>("draft");
  const [completionCondition, setCompletionCondition] = useState("Task status reaches complete");
  const [checklistText, setChecklistText] = useState("");
  const [heartbeatEnabled, setHeartbeatEnabled] = useState(false);
  const [heartbeatCadence, setHeartbeatCadence] = useState("60");
  const [heartbeatMaxRuns, setHeartbeatMaxRuns] = useState("");
  const [heartbeatMessage, setHeartbeatMessage] = useState("");
  const [environmentId, setEnvironmentId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [dispatchingTaskId, setDispatchingTaskId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const selectedTask =
    tasks.find((task) => String(task.taskId) === selectedTaskId) ?? tasks[0] ?? null;
  const selectedTaskTarget = selectedTask
    ? (targets.find(
        (target) =>
          String(target.environmentId) === String(selectedTask.target.environmentId) &&
          String(target.projectId) === String(selectedTask.target.projectId) &&
          String(target.threadId) === String(selectedTask.target.threadId),
      ) ?? null)
    : null;
  const selectedTaskHeartbeat =
    selectedTask?.heartbeatId === null || selectedTask?.heartbeatId === undefined
      ? null
      : (heartbeats.find((record) => record.heartbeatId === selectedTask.heartbeatId) ?? null);
  const environments = useMemo(
    () =>
      Array.from(new Map(targets.map((target) => [String(target.environmentId), target])).values()),
    [targets],
  );
  const projects = useMemo(
    () =>
      Array.from(
        new Map(
          targets
            .filter((target) => String(target.environmentId) === environmentId)
            .map((target) => [String(target.projectId), target]),
        ).values(),
      ),
    [environmentId, targets],
  );
  const threads = useMemo(
    () =>
      targets.filter(
        (target) =>
          String(target.environmentId) === environmentId && String(target.projectId) === projectId,
      ),
    [environmentId, projectId, targets],
  );
  const selectedTarget = targets.find(
    (target) =>
      String(target.environmentId) === environmentId &&
      String(target.projectId) === projectId &&
      String(target.threadId) === threadId,
  );
  const canCreate =
    title.trim().length > 0 &&
    outcome.trim().length > 0 &&
    completionCondition.trim().length > 0 &&
    selectedTarget !== undefined;
  const submit = async () => {
    if (!canCreate || selectedTarget === undefined) return;
    setIsCreating(true);
    try {
      const now = new Date().toISOString();
      const checklistItems = checklistText
        .split("\n")
        .map((text) => text.trim())
        .filter(Boolean)
        .map((text, index) => ({
          itemId: `${newCommandId()}-${index}`,
          text,
          state: "open" as const,
          evidence: null,
          updatedBy: null,
          updatedAt: now,
        }));
      await onCreateTask({
        title: title.trim(),
        outcome: outcome.trim(),
        priority,
        status,
        completionCondition: completionCondition.trim(),
        checklistItems,
        target: selectedTarget,
        heartbeat: heartbeatEnabled
          ? {
              enabled: true,
              cadenceMinutes: heartbeatCadence.trim() === "" ? null : Number(heartbeatCadence),
              maxRuns: heartbeatMaxRuns.trim() === "" ? null : Number(heartbeatMaxRuns),
              message: heartbeatMessage.trim() || null,
            }
          : null,
      });
      setTitle("");
      setOutcome("");
      setEnvironmentId(null);
      setProjectId(null);
      setThreadId(null);
      setChecklistText("");
      setHeartbeatEnabled(false);
      setHeartbeatMessage("");
    } finally {
      setIsCreating(false);
    }
  };
  const dispatch = async (task: PortfolioTask) => {
    setDispatchingTaskId(String(task.taskId));
    try {
      await onDispatchTask(task);
    } finally {
      setDispatchingTaskId(null);
    }
  };
  return (
    <section className="mt-8 rounded-xl border border-border/70 bg-card/30 p-5" aria-label="Tasks">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-300">
            Canonical Tasks
          </p>
          <h2 className="mt-1 font-medium">Owner-backed task list</h2>
        </div>
        <span className="rounded-full border border-border px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
          {isPending ? "Reading" : `${tasks.length} task${tasks.length === 1 ? "" : "s"}`}
        </span>
      </div>
      <div
        className="mt-5 rounded-lg border border-sky-400/20 bg-sky-400/5 p-4"
        aria-label="Create Task"
      >
        <h3 className="font-medium">Create a Task</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Choose the exact native environment, project, and thread before writing.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input
            aria-label="Task title"
            className="rounded border border-border bg-background px-3 py-2 text-sm"
            placeholder="Task title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <textarea
            aria-label="Task outcome"
            className="min-h-20 rounded border border-border bg-background px-3 py-2 text-sm sm:col-span-2"
            placeholder="Detailed outcome / description"
            value={outcome}
            onChange={(event) => setOutcome(event.target.value)}
          />
          <select
            aria-label="Task priority"
            className="rounded border border-border bg-background px-3 py-2 text-sm"
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
          >
            {(["low", "normal", "high", "urgent"] as const).map((value) => (
              <option key={value} value={value}>
                {value} priority
              </option>
            ))}
          </select>
          <select
            aria-label="Initial Task status"
            className="rounded border border-border bg-background px-3 py-2 text-sm"
            value={status}
            onChange={(event) => setStatus(event.target.value as PortfolioTaskStatus)}
          >
            {(["draft", "ready", "in_progress", "blocked"] as const).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <select
            aria-label="Task environment"
            className="rounded border border-border bg-background px-3 py-2 text-sm"
            value={environmentId ?? ""}
            onChange={(event) => {
              setEnvironmentId(event.target.value || null);
              setProjectId(null);
              setThreadId(null);
            }}
          >
            <option value="">Select environment</option>
            {environments.map((target) => (
              <option key={String(target.environmentId)} value={String(target.environmentId)}>
                {formatPortfolioTaskEnvironmentLabel(
                  String(target.environmentId),
                  environmentLabels,
                )}
              </option>
            ))}
          </select>
          <input
            aria-label="Completion condition"
            className="rounded border border-border bg-background px-3 py-2 text-sm sm:col-span-2"
            placeholder="Completion condition"
            value={completionCondition}
            onChange={(event) => setCompletionCondition(event.target.value)}
          />
          <textarea
            aria-label="Checklist items"
            className="min-h-20 rounded border border-border bg-background px-3 py-2 text-sm sm:col-span-2"
            placeholder="Checklist items (one per line)"
            value={checklistText}
            onChange={(event) => setChecklistText(event.target.value)}
          />
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={heartbeatEnabled}
              onChange={(event) => setHeartbeatEnabled(event.target.checked)}
            />{" "}
            Configure a linked recurring Heartbeat (starts paused)
          </label>
          {heartbeatEnabled ? (
            <div className="grid gap-2 rounded border border-violet-400/20 bg-violet-400/5 p-3 sm:col-span-2 sm:grid-cols-2">
              <label className="text-xs text-muted-foreground">
                Cadence minutes
                <input
                  type="number"
                  min="0"
                  className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
                  value={heartbeatCadence}
                  onChange={(event) => setHeartbeatCadence(event.target.value)}
                />
              </label>
              <label className="text-xs text-muted-foreground">
                Maximum runs (optional)
                <input
                  type="number"
                  min="0"
                  className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
                  value={heartbeatMaxRuns}
                  onChange={(event) => setHeartbeatMaxRuns(event.target.value)}
                />
              </label>
              <label className="text-xs text-muted-foreground sm:col-span-2">
                Heartbeat message (optional)
                <textarea
                  className="mt-1 min-h-20 w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
                  placeholder="Message sent on every run; blank uses the Task fallback."
                  value={heartbeatMessage}
                  onChange={(event) => setHeartbeatMessage(event.target.value)}
                />
              </label>
              <p className="text-xs text-muted-foreground sm:col-span-2">
                The linked Heartbeat uses the same exact native target and remains paused until an
                explicit native control starts it.
              </p>
            </div>
          ) : null}
          <select
            aria-label="Task project"
            className="rounded border border-border bg-background px-3 py-2 text-sm"
            value={projectId ?? ""}
            disabled={environmentId === null}
            onChange={(event) => {
              setProjectId(event.target.value || null);
              setThreadId(null);
            }}
          >
            <option value="">Select project</option>
            {projects.map((target) => (
              <option key={String(target.projectId)} value={String(target.projectId)}>
                {target.projectTitle}
              </option>
            ))}
          </select>
          <select
            aria-label="Task thread"
            className="rounded border border-border bg-background px-3 py-2 text-sm sm:col-span-2"
            value={threadId ?? ""}
            disabled={projectId === null}
            onChange={(event) => setThreadId(event.target.value || null)}
          >
            <option value="">Select thread</option>
            {threads.map((target) => (
              <option key={String(target.threadId)} value={String(target.threadId)}>
                {target.threadTitle}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="mt-3 rounded-md bg-sky-500 px-3 py-2 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!canCreate || isCreating}
          onClick={() => void submit()}
        >
          {isCreating ? "Creating…" : "Create Task"}
        </button>
      </div>
      {tasks.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No canonical Tasks are available for this environment.
        </p>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
          <ul className="space-y-3">
            {tasks.map((task) => {
              const linkedHeartbeat =
                task.heartbeatId === null
                  ? null
                  : (heartbeats.find((record) => record.heartbeatId === task.heartbeatId) ?? null);
              const target = targets.find(
                (candidate) =>
                  String(candidate.environmentId) === String(task.target.environmentId) &&
                  String(candidate.projectId) === String(task.target.projectId) &&
                  String(candidate.threadId) === String(task.target.threadId),
              );
              const isSelected = String(task.taskId) === String(selectedTask?.taskId);
              return (
                <li
                  key={String(task.taskId)}
                  className={`rounded-xl border p-4 shadow-sm transition-colors ${isSelected ? "border-sky-400/60 bg-slate-900/90 shadow-sky-950/30" : "border-border/60 bg-slate-950/45 hover:border-sky-400/30"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      className="min-w-0 text-left"
                      aria-pressed={isSelected}
                      onClick={() => setSelectedTaskId(String(task.taskId))}
                    >
                      <h3 className="truncate font-medium text-foreground">{task.title}</h3>
                      <p className="mt-1 text-[11px] text-sky-300">
                        {isSelected ? "Selected task" : "Select for details"}
                      </p>
                    </button>
                    <label className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                      <span className="sr-only">Status for {task.title}</span>
                      <select
                        aria-label={`Status for ${task.title}`}
                        className="rounded border border-border bg-background px-2 py-1 text-xs uppercase tracking-wide"
                        value={task.status}
                        onChange={(event) =>
                          onStatusChange(task, event.target.value as PortfolioTaskStatus)
                        }
                      >
                        {(
                          [
                            "draft",
                            "ready",
                            "in_progress",
                            "blocked",
                            "complete",
                            "cancelled",
                          ] as const
                        ).map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{task.outcome}</p>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Priority: <span className="text-foreground/80">{task.priority}</span> · Updated{" "}
                    {formatPortfolioTaskUpdatedAt(task.updatedAt)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatPortfolioTaskEnvironmentLabel(
                      String(task.target.environmentId),
                      environmentLabels,
                    )}{" "}
                    · {target?.threadTitle ?? "Unknown thread"} · Assigned to{" "}
                    {formatPortfolioTaskAssignedAgent(task)}
                  </p>
                  <div className="mt-3 rounded-md border border-border/50 bg-background/30 p-3 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">Checklist progress</span>
                      <span className="text-muted-foreground">
                        {formatPortfolioTaskChecklistProgress(task)} complete
                      </span>
                    </div>
                    {task.checklistItems.length > 0 ? (
                      <ul className="mt-2 space-y-1 text-muted-foreground">
                        {task.checklistItems.map((item) => (
                          <li key={String(item.itemId)}>
                            {item.state === "complete" ? "✓" : "○"} {item.text}
                            {item.evidence ? ` · ${item.evidence}` : ""}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-muted-foreground">No checklist items.</p>
                    )}
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Completion: {task.completionCondition}
                  </p>
                  {task.lastReceipt ? (
                    <div className="mt-3 rounded-md border border-emerald-400/20 bg-emerald-400/5 p-3 text-xs">
                      <p className="font-medium text-emerald-300">
                        Latest native receipt: {task.lastReceipt.status}
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        {task.lastReceipt.detail} · observed {task.lastReceipt.observedAt}
                      </p>
                    </div>
                  ) : null}
                  {task.heartbeatId !== null ? (
                    <div className="mt-3 rounded-md border border-violet-400/20 bg-violet-400/5 p-3 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">Linked Heartbeat</span>
                        <span className="text-violet-200">
                          {linkedHeartbeat?.status ?? "not read back"}
                        </span>
                      </div>
                      {linkedHeartbeat ? (
                        <>
                          <p className="mt-1 text-muted-foreground">
                            Every {linkedHeartbeat.cadenceMinutes ?? "manual"} minutes ·{" "}
                            {linkedHeartbeat.runCount} runs ·{" "}
                            {linkedHeartbeat.pauseReason ?? "No pause reason"}
                          </p>
                          <button
                            type="button"
                            className="mt-2 rounded border border-violet-400/30 px-2 py-1 text-violet-200 hover:bg-violet-400/10"
                            onClick={() =>
                              void onHeartbeatUpsert({
                                ...linkedHeartbeat,
                                status: "paused",
                                pauseReason: "Paused from linked Task view.",
                                updatedAt: new Date().toISOString(),
                              })
                            }
                          >
                            Pause linked Heartbeat
                          </button>
                        </>
                      ) : (
                        <p className="mt-1 text-muted-foreground">
                          The linked Heartbeat record is not available in the current owner
                          readback.
                        </p>
                      )}
                    </div>
                  ) : null}
                  <button
                    type="button"
                    className="mt-3 rounded-md border border-sky-400/40 px-3 py-2 text-xs font-medium text-sky-300 hover:bg-sky-400/10 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={dispatchingTaskId !== null}
                    onClick={() => void dispatch(task)}
                  >
                    {dispatchingTaskId === String(task.taskId)
                      ? "Dispatching…"
                      : "Dispatch to native thread"}
                  </button>
                </li>
              );
            })}
          </ul>
          {selectedTask ? (
            <aside
              aria-label="Selected Task details"
              className="h-fit rounded-xl border border-sky-400/25 bg-slate-950/70 p-5 shadow-lg shadow-slate-950/30"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-300">
                    Task detail
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-foreground">
                    {selectedTask.title}
                  </h3>
                </div>
                <span className="rounded-full border border-sky-400/30 px-2 py-1 text-[10px] uppercase tracking-wide text-sky-200">
                  {selectedTask.status}
                </span>
              </div>
              <div className="mt-4 space-y-4 text-sm">
                <section>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Outcome
                  </h4>
                  <p className="mt-1 leading-6 text-foreground/85">{selectedTask.outcome}</p>
                </section>
                <section>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Completion condition
                  </h4>
                  <p className="mt-1 text-foreground/85">{selectedTask.completionCondition}</p>
                </section>
                <section>
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Checklist
                    </h4>
                    <span className="text-xs text-sky-200">
                      {formatPortfolioTaskChecklistProgress(selectedTask)} complete
                    </span>
                  </div>
                  <ul className="mt-2 space-y-2 rounded-lg border border-border/60 bg-background/25 p-3 text-xs">
                    {selectedTask.checklistItems.length > 0 ? (
                      selectedTask.checklistItems.map((item) => (
                        <li key={String(item.itemId)} className="flex gap-2 text-foreground/80">
                          <span
                            className={
                              item.state === "complete"
                                ? "text-emerald-300"
                                : "text-muted-foreground"
                            }
                          >
                            {item.state === "complete" ? "✓" : "○"}
                          </span>
                          <span>
                            {item.text}
                            {item.evidence ? (
                              <span className="block text-muted-foreground">
                                Evidence: {item.evidence}
                              </span>
                            ) : null}
                          </span>
                        </li>
                      ))
                    ) : (
                      <li className="text-muted-foreground">No checklist items.</li>
                    )}
                  </ul>
                </section>
                <section>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Assignment
                  </h4>
                  <p className="mt-1 text-foreground/85">
                    {formatPortfolioTaskEnvironmentLabel(
                      String(selectedTask.target.environmentId),
                      environmentLabels,
                    )}{" "}
                    · {selectedTaskTarget?.projectTitle ?? "Unknown project"} ·{" "}
                    {selectedTaskTarget?.threadTitle ?? "Unknown thread"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Agent: {formatPortfolioTaskAssignedAgent(selectedTask)} · Updated{" "}
                    {formatPortfolioTaskUpdatedAt(selectedTask.updatedAt)}
                  </p>
                </section>
                <section>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Evidence & receipt history
                  </h4>
                  {selectedTask.evidenceLinks.length > 0 ? (
                    <ul className="mt-2 space-y-1 text-xs text-foreground/80">
                      {selectedTask.evidenceLinks.map((link) => (
                        <li key={link.linkId}>
                          • {link.title} · {link.repository}/{link.relativePath} · {link.owningHost}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">
                      No evidence links recorded.
                    </p>
                  )}
                  {selectedTask.lastReceipt ? (
                    <p className="mt-2 rounded-lg border border-emerald-400/20 bg-emerald-400/5 p-3 text-xs text-emerald-100">
                      Task receipt: {selectedTask.lastReceipt.status} ·{" "}
                      {selectedTask.lastReceipt.detail} · {selectedTask.lastReceipt.observedAt}
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">No Task receipt recorded.</p>
                  )}
                </section>
                {selectedTask.heartbeatId !== null ? (
                  <section className="rounded-lg border border-violet-400/25 bg-violet-400/5 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-violet-200">
                        Linked Heartbeat
                      </h4>
                      <span className="text-xs text-violet-100">
                        {selectedTaskHeartbeat?.status ?? "not read back"}
                      </span>
                    </div>
                    {selectedTaskHeartbeat ? (
                      <>
                        <p className="mt-2 text-xs text-foreground/80">
                          {selectedTaskHeartbeat.runCount} deliveries · every{" "}
                          {selectedTaskHeartbeat.cadenceMinutes ?? "manual"} minutes
                        </p>
                        {selectedTaskHeartbeat.lastReceipt ? (
                          <p className="mt-2 text-xs text-violet-100">
                            Last delivery: {selectedTaskHeartbeat.lastReceipt.status} ·{" "}
                            {selectedTaskHeartbeat.lastReceipt.detail} ·{" "}
                            {selectedTaskHeartbeat.lastReceipt.observedAt}
                          </p>
                        ) : (
                          <p className="mt-2 text-xs text-muted-foreground">
                            No delivery receipt yet.
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Heartbeat record is not available in the current owner readback.
                      </p>
                    )}
                  </section>
                ) : null}
              </div>
            </aside>
          ) : null}
        </div>
      )}
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
