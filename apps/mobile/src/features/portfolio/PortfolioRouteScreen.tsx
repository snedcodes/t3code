import {
  CommandId,
  MessageId,
  type EnvironmentId,
  type PortfolioHeartbeatLifecycleState,
} from "@t3tools/contracts";
import { useMemo, useState } from "react";
import { useAtomCommand } from "../../state/use-atom-command";
import { Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";

import { AppText as Text } from "../../components/AppText";
import { AndroidScreenHeader } from "../../components/AndroidScreenHeader";
import { NativeHeaderToolbar } from "../../native/StackHeader";
import { useThemeColor } from "../../lib/useThemeColor";
import { useEnvironments } from "../../state/environments";
import { useProjects, useThreadShells } from "../../state/entities";
import {
  portfolioEnvironment,
  usePortfolioHeartbeatOwner,
  usePortfolioHeartbeatRecords,
  usePortfolioTasks,
  usePortfolioWishlists,
} from "../../state/portfolio";
import { makePortfolioTaskStatusTransitionInput } from "../../state/portfolioTaskStatusTransition";
import {
  makePortfolioWishlistCreateInput,
  makePortfolioWishlistPromotionCommandInput,
} from "./portfolioWishlistActions";
import { PortfolioWishlistPanel } from "./PortfolioWishlistPanel";
import { toPortfolioTargetList } from "../../state/portfolioTargets";
import { makeQueuedMessageMetadata } from "../../lib/commandMetadata";
import { enqueueThreadOutboxMessage } from "../../state/thread-outbox";

function roleLabel(role: string | null | undefined): string {
  switch (role) {
    case "owner":
      return "Owner";
    case "non_owner":
      return "Non-owner";
    default:
      return "Not connected";
  }
}

export function PortfolioRouteScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const mutedTextColor = useThemeColor("--color-foreground-muted");
  const { environments } = useEnvironments();
  const projects = useProjects();
  const threads = useThreadShells();
  const targets = useMemo(() => toPortfolioTargetList(environments), [environments]);
  const [selectedId, setSelectedId] = useState<EnvironmentId | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [messageDraft, setMessageDraft] = useState("");
  const [messageState, setMessageState] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const [heartbeatMessageDrafts, setHeartbeatMessageDrafts] = useState<Record<string, string>>({});
  const selected =
    targets.find((target) => target.environmentId === selectedId) ?? targets[0] ?? null;
  const ownerQuery = usePortfolioHeartbeatOwner(selected?.environmentId ?? null);
  const owner = ownerQuery.data;
  const tasksQuery = usePortfolioTasks(selected?.environmentId ?? null);
  const heartbeatRecordsQuery = usePortfolioHeartbeatRecords(selected?.environmentId ?? null);
  const wishlistsQuery = usePortfolioWishlists(selected?.environmentId ?? null);
  const transitionTaskStatus = useAtomCommand(portfolioEnvironment.transitionTaskStatus);
  const createWishlist = useAtomCommand(portfolioEnvironment.createWishlist);
  const promoteWishlist = useAtomCommand(portfolioEnvironment.promoteWishlist);
  const upsertHeartbeatRecord = useAtomCommand(portfolioEnvironment.upsertHeartbeatRecord);
  const tasks = tasksQuery.data?.tasks ?? [];
  const heartbeatRecords = heartbeatRecordsQuery.data?.records ?? [];
  const wishlists = wishlistsQuery.data?.wishlists ?? [];
  const [wishlistTitle, setWishlistTitle] = useState("");
  const [wishlistSummary, setWishlistSummary] = useState("");
  const [wishlistState, setWishlistState] = useState<"idle" | "saving" | "failed">("idle");

  async function saveWishlist() {
    const title = wishlistTitle.trim();
    const summary = wishlistSummary.trim();
    if (!selected || title.length === 0 || summary.length === 0 || wishlistState === "saving")
      return;
    setWishlistState("saving");
    try {
      await createWishlist({
        environmentId: selected.environmentId,
        input: makePortfolioWishlistCreateInput(
          `wishlist-${Date.now()}`,
          title,
          summary,
          new Date().toISOString(),
        ),
      });
      setWishlistTitle("");
      setWishlistSummary("");
      setWishlistState("idle");
    } catch {
      setWishlistState("failed");
    }
  }

  async function promoteWishlistToTask(
    wishlist: (typeof wishlists)[number],
    task: (typeof tasks)[number],
  ) {
    if (!selected || selected.environmentId !== task.target.environmentId) return;
    await promoteWishlist({
      environmentId: task.target.environmentId,
      input: makePortfolioWishlistPromotionCommandInput(wishlist, task, new Date().toISOString())
        .input,
    });
  }

  async function setTaskStatus(
    task: (typeof tasks)[number],
    status: "in_progress" | "blocked" | "complete",
  ) {
    if (selected?.environmentId !== task.target.environmentId) return;
    await transitionTaskStatus({
      environmentId: task.target.environmentId,
      input: makePortfolioTaskStatusTransitionInput(task, status),
    });
  }

  async function setHeartbeatStatus(
    record: (typeof heartbeatRecords)[number],
    status: PortfolioHeartbeatLifecycleState,
  ) {
    // The owner scheduler consumes paused records with a due nextRunAt. Mobile
    // requests lifecycle changes through the same owner upsert path; it never
    // dispatches a second scheduler or sends a direct thread turn.
    const shouldRun = status === "active";
    await upsertHeartbeatRecord({
      environmentId: record.target.environmentId,
      input: {
        ...record,
        status: shouldRun ? "paused" : status,
        nextRunAt: shouldRun ? new Date().toISOString() : status === "paused" ? null : null,
        pauseReason: shouldRun ? null : status === "paused" ? "Paused from T3 Mobile." : null,
        stopReason: status === "stopped" ? "Stopped from T3 Mobile." : null,
        updatedAt: new Date().toISOString(),
      },
    });
  }

  function heartbeatMessageDraft(key: string, fallback = "") {
    return Object.prototype.hasOwnProperty.call(heartbeatMessageDrafts, key)
      ? (heartbeatMessageDrafts[key] ?? "")
      : fallback;
  }

  function setHeartbeatMessageDraft(key: string, message: string) {
    setHeartbeatMessageDrafts((current) => ({ ...current, [key]: message }));
  }

  async function linkHeartbeat(task: (typeof tasks)[number]) {
    if (!selected || task.heartbeatId !== null) return;
    const now = new Date().toISOString();
    const draftKey = `task:${String(task.taskId)}`;
    await upsertHeartbeatRecord({
      environmentId: task.target.environmentId,
      input: {
        heartbeatId: `heartbeat-${String(task.taskId)}`,
        taskId: task.taskId,
        message: heartbeatMessageDraft(draftKey).trim() || null,
        nextRunAt: null,
        target: task.target,
        status: "paused",
        cadenceMinutes: 60,
        maxRuns: null,
        runCount: 0,
        expiresAt: null,
        finishLine: task.completionCondition,
        stopConditions: [
          "Task reaches complete",
          "Task is blocked",
          "Operator pauses the Heartbeat",
        ],
        preventOverlap: true,
        pauseReason: "Linked from T3 Mobile; awaiting explicit start.",
        stopReason: null,
        lastReceipt: null,
        updatedAt: now,
      },
    });
    setHeartbeatMessageDrafts((current) => {
      const next = { ...current };
      delete next[draftKey];
      return next;
    });
  }

  async function saveHeartbeatMessage(record: (typeof heartbeatRecords)[number]) {
    const draftKey = `heartbeat:${record.heartbeatId}`;
    await upsertHeartbeatRecord({
      environmentId: record.target.environmentId,
      input: {
        ...record,
        message: heartbeatMessageDraft(draftKey, record.message ?? "").trim() || null,
        updatedAt: new Date().toISOString(),
      },
    });
  }
  const projectTitles = useMemo(
    () =>
      new Map(
        projects
          .filter((project) => project.environmentId === selected?.environmentId)
          .map((project) => [String(project.id), project.title]),
      ),
    [projects, selected?.environmentId],
  );
  const selectedThreads = useMemo(
    () =>
      threads
        .filter(
          (thread) =>
            thread.environmentId === selected?.environmentId && thread.archivedAt === null,
        )
        .slice(0, 20),
    [selected?.environmentId, threads],
  );
  const selectedThread =
    selectedThreads.find((thread) => String(thread.id) === selectedThreadId) ??
    selectedThreads[0] ??
    null;

  async function sendPortfolioMessage() {
    const text = messageDraft.trim();
    if (!selectedThread || text.length === 0 || messageState === "sending") {
      return;
    }

    const metadata = makeQueuedMessageMetadata();
    setMessageState("sending");
    try {
      await enqueueThreadOutboxMessage({
        environmentId: selectedThread.environmentId,
        threadId: selectedThread.id,
        messageId: MessageId.make(metadata.messageId),
        commandId: CommandId.make(metadata.commandId),
        text,
        attachments: [],
        ...(selectedThread.modelSelection ? { modelSelection: selectedThread.modelSelection } : {}),
        ...(selectedThread.runtimeMode ? { runtimeMode: selectedThread.runtimeMode } : {}),
        ...(selectedThread.interactionMode
          ? { interactionMode: selectedThread.interactionMode }
          : {}),
        createdAt: metadata.createdAt,
      });
      setMessageDraft("");
      setMessageState("sent");
    } catch {
      setMessageState("failed");
    }
  }

  return (
    <View collapsable={false} className="flex-1 bg-sheet">
      {Platform.OS === "android" ? (
        <AndroidScreenHeader title="Portfolio" onBack={() => navigation.goBack()} />
      ) : (
        <NativeHeaderToolbar placement="left" />
      )}
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        className="flex-1"
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom, 18) + 18,
          paddingHorizontal: 20,
          paddingTop: 16,
        }}
      >
        <View className="gap-2">
          <Text className="px-2 text-sm font-t3-medium text-foreground-muted">
            Native environments
          </Text>
          <View className="overflow-hidden rounded-[24px] bg-card">
            {targets.length > 0 ? (
              targets.map((target, index) => (
                <Pressable
                  key={String(target.environmentId)}
                  accessibilityRole="button"
                  accessibilityState={{
                    selected: selected?.environmentId === target.environmentId,
                  }}
                  onPress={() => setSelectedId(target.environmentId)}
                  className={`p-4 ${index === 0 ? "" : "border-t border-border"} ${selected?.environmentId === target.environmentId ? "bg-subtle" : ""}`}
                >
                  <Text className="text-base font-t3-medium text-foreground">{target.label}</Text>
                  <Text className="mt-1 text-sm text-foreground-muted">
                    {String(target.environmentId)} · {target.connectionStatus.phase}
                  </Text>
                </Pressable>
              ))
            ) : (
              <Text className="p-5 text-sm leading-normal text-foreground-muted">
                No native environments are connected yet. Add one from Settings → Environments.
              </Text>
            )}
          </View>
        </View>

        <View className="mt-6 gap-2">
          <Text className="px-2 text-sm font-t3-medium text-foreground-muted">Tasks</Text>
          <View className="overflow-hidden rounded-[24px] bg-card">
            {tasks.length > 0 ? (
              tasks.map((task, index) => (
                <View
                  key={String(task.taskId)}
                  className={`p-4 ${index === 0 ? "" : "border-t border-border"}`}
                >
                  <Text className="text-base font-t3-medium text-foreground">{task.title}</Text>
                  <Text className="mt-1 text-sm text-foreground-muted">
                    {task.status} · {task.priority}
                  </Text>
                  <Text className="mt-2 text-sm leading-normal text-foreground-muted">
                    Outcome: {task.outcome}
                  </Text>
                  <Text className="mt-1 text-sm leading-normal text-foreground-muted">
                    Target:{" "}
                    {projectTitles.get(String(task.target.projectId)) ??
                      String(task.target.projectId)}{" "}
                    ·{" "}
                    {selectedThreads.find(
                      (thread) => String(thread.id) === String(task.target.threadId),
                    )?.title ?? String(task.target.threadId)}
                  </Text>
                  <Text className="mt-2 text-xs text-foreground-muted">
                    Checklist:{" "}
                    {task.checklistItems.filter((item) => item.state === "complete").length}/
                    {task.checklistItems.length} complete · {task.completionCondition}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      void setTaskStatus(
                        task,
                        task.status === "in_progress" ? "blocked" : "in_progress",
                      )
                    }
                    className="mt-3 rounded-[12px] bg-subtle px-3 py-2"
                  >
                    <Text className="text-xs text-foreground-muted">
                      {task.status === "in_progress" ? "Block task" : "Start task"}
                    </Text>
                  </Pressable>
                  {task.heartbeatId === null ? (
                    <View className="mt-3 gap-2">
                      <TextInput
                        accessibilityLabel={`Heartbeat message for ${task.title}`}
                        multiline
                        placeholder="Heartbeat message (optional)"
                        placeholderTextColor={mutedTextColor}
                        value={heartbeatMessageDraft(`task:${String(task.taskId)}`)}
                        onChangeText={(value) =>
                          setHeartbeatMessageDraft(`task:${String(task.taskId)}`, value)
                        }
                        className="min-h-20 rounded-[12px] border border-input-border bg-input px-3 py-2 text-sm text-foreground"
                      />
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => void linkHeartbeat(task)}
                        className="self-start rounded-[12px] border border-input-border bg-input px-3 py-2"
                      >
                        <Text className="text-xs text-foreground-muted">Link Heartbeat</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              ))
            ) : tasksQuery.isPending ? (
              <Text className="p-5 text-sm text-foreground-muted">Reading tasks...</Text>
            ) : tasksQuery.error ? (
              <Text className="p-5 text-sm text-foreground-muted">
                Tasks are unavailable for this environment.
              </Text>
            ) : (
              <Text className="p-5 text-sm text-foreground-muted">
                No tasks for the selected environment.
              </Text>
            )}
          </View>
        </View>

        <View className="mt-6 gap-2">
          <Text className="px-2 text-sm font-t3-medium text-foreground-muted">Heartbeats</Text>
          <View className="overflow-hidden rounded-[24px] bg-card">
            {heartbeatRecords.length > 0 ? (
              heartbeatRecords.map((record, index) => {
                const linkedTask = tasks.find(
                  (task) => String(task.taskId) === String(record.taskId),
                );
                return (
                  <View
                    key={record.heartbeatId}
                    className={`p-4 ${index === 0 ? "" : "border-t border-border"}`}
                  >
                    <Text className="text-base font-t3-medium text-foreground">
                      {linkedTask?.title ?? record.heartbeatId}
                    </Text>
                    <Text className="mt-1 text-sm text-foreground-muted">
                      {record.status} · every {record.cadenceMinutes ?? "—"} min · {record.runCount}{" "}
                      runs
                    </Text>
                    <Text className="mt-1 text-xs text-foreground-muted">
                      Next run: {record.nextRunAt ?? "not scheduled"} ·{" "}
                      {record.lastReceipt?.status ?? "no receipt"}
                    </Text>
                    <TextInput
                      accessibilityLabel={`Heartbeat message for ${linkedTask?.title ?? record.heartbeatId}`}
                      multiline
                      placeholder="Message sent on every run; blank uses the fallback."
                      placeholderTextColor={mutedTextColor}
                      value={heartbeatMessageDraft(
                        `heartbeat:${record.heartbeatId}`,
                        record.message ?? "",
                      )}
                      onChangeText={(value) =>
                        setHeartbeatMessageDraft(`heartbeat:${record.heartbeatId}`, value)
                      }
                      className="mt-3 min-h-20 rounded-[12px] border border-input-border bg-input px-3 py-2 text-sm text-foreground"
                    />
                    <View className="mt-3 flex-row flex-wrap gap-2">
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => void saveHeartbeatMessage(record)}
                        className="rounded-[12px] border border-primary/40 bg-primary/10 px-3 py-2"
                      >
                        <Text className="text-xs text-primary">Save message</Text>
                      </Pressable>
                      {record.status === "active" ||
                      (record.status === "paused" && record.nextRunAt !== null) ? (
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => void setHeartbeatStatus(record, "paused")}
                          className="rounded-[12px] bg-subtle px-3 py-2"
                        >
                          <Text className="text-xs text-foreground-muted">Pause</Text>
                        </Pressable>
                      ) : null}
                      {record.status === "paused" ? (
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => void setHeartbeatStatus(record, "active")}
                          className="rounded-[12px] bg-primary px-3 py-2"
                        >
                          <Text className="text-xs text-primary-foreground">Start / Resume</Text>
                        </Pressable>
                      ) : null}
                      {record.status !== "stopped" && record.status !== "completed" ? (
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => void setHeartbeatStatus(record, "stopped")}
                          className="rounded-[12px] border border-input-border bg-input px-3 py-2"
                        >
                          <Text className="text-xs text-foreground-muted">Stop</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                );
              })
            ) : (
              <Text className="p-5 text-sm text-foreground-muted">
                {heartbeatRecordsQuery.isPending
                  ? "Reading Heartbeats..."
                  : "No Heartbeat records for the selected environment."}
              </Text>
            )}
          </View>
        </View>

        <PortfolioWishlistPanel
          wishlists={wishlists}
          tasks={tasks}
          isPending={wishlistsQuery.isPending}
          onCreate={async (title, summary) => {
            if (!selected) return;
            await createWishlist({
              environmentId: selected.environmentId,
              input: makePortfolioWishlistCreateInput(
                "wishlist-" + Date.now(),
                title,
                summary,
                new Date().toISOString(),
              ),
            });
          }}
          onPromote={promoteWishlistToTask}
        />

        <View className="mt-6 gap-2">
          <Text className="px-2 text-sm font-t3-medium text-foreground-muted">Native threads</Text>
          <View className="overflow-hidden rounded-[24px] bg-card">
            {selectedThreads.length > 0 ? (
              selectedThreads.map((thread, index) => (
                <View
                  key={String(thread.id)}
                  className={`p-4 ${index === 0 ? "" : "border-t border-border"} ${selectedThread?.id === thread.id ? "bg-subtle" : ""}`}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: selectedThread?.id === thread.id }}
                    onPress={() => setSelectedThreadId(String(thread.id))}
                  >
                    <Text className="text-base font-t3-medium text-foreground">{thread.title}</Text>
                    <Text className="mt-1 text-sm text-foreground-muted">
                      {projectTitles.get(String(thread.projectId)) ?? "Unknown project"} ·{" "}
                      {thread.session?.status ?? "not started"}
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${thread.title}`}
                    onPress={() =>
                      navigation.navigate("Thread", {
                        environmentId: thread.environmentId,
                        threadId: thread.id,
                      })
                    }
                    className="mt-3 self-start rounded-[14px] border border-input-border bg-input px-3.5 py-2 active:opacity-70"
                  >
                    <Text className="text-xs font-t3-bold tracking-[0.8px] uppercase text-foreground-muted">
                      Open thread
                    </Text>
                  </Pressable>
                </View>
              ))
            ) : (
              <Text className="p-5 text-sm leading-normal text-foreground-muted">
                No native threads are available for the selected environment yet.
              </Text>
            )}
          </View>
          <Text className="px-2 text-xs leading-normal text-foreground-muted">
            Select a thread to message that exact agent through T3. Portfolio uses the same durable
            thread outbox as the normal composer; it does not create a separate transport.
          </Text>
        </View>

        {selectedThread ? (
          <View className="mt-6 gap-2">
            <Text className="px-2 text-sm font-t3-medium text-foreground">
              Message selected agent
            </Text>
            <View className="gap-3 rounded-[24px] bg-card p-5">
              <Text className="text-sm text-foreground-muted" numberOfLines={1}>
                {selectedThread.title} · {selected?.label ?? "Unknown environment"}
              </Text>
              <TextInput
                accessibilityLabel="Message selected agent"
                multiline
                placeholder="Send a message to this agent…"
                value={messageDraft}
                onChangeText={(value) => {
                  setMessageDraft(value);
                  if (messageState !== "idle") setMessageState("idle");
                }}
                className="min-h-[88px] rounded-[18px] border border-input-border bg-input px-4 py-3 text-base text-foreground"
                textAlignVertical="top"
              />
              <View className="flex-row items-center justify-between gap-3">
                <Text className="flex-1 text-xs leading-normal text-foreground-muted">
                  {messageState === "sent"
                    ? "Queued for delivery."
                    : messageState === "failed"
                      ? "Could not queue the message. Try again."
                      : "Delivery follows this environment's normal T3 connection."}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Send message to selected agent"
                  disabled={messageDraft.trim().length === 0 || messageState === "sending"}
                  onPress={() => void sendPortfolioMessage()}
                  className="min-h-[42px] rounded-[14px] bg-primary px-4 py-2.5 active:opacity-70 disabled:opacity-50"
                >
                  <Text className="text-xs font-t3-bold tracking-[0.8px] uppercase text-primary-foreground">
                    {messageState === "sending" ? "Sending…" : "Send"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}

        <View className="mt-6 gap-2">
          <Text className="px-2 text-sm font-t3-medium text-foreground-muted">Heartbeat owner</Text>
          <View className="gap-2 rounded-[24px] bg-card p-5">
            <View className="flex-row items-center justify-between gap-3">
              <Text className="text-lg font-t3-medium text-foreground">
                {selected?.label ?? "No environment selected"}
              </Text>
              <Text className="text-sm text-foreground-muted">
                {ownerQuery.isPending ? "Reading…" : roleLabel(owner?.role)}
              </Text>
            </View>
            <Text className="text-sm leading-normal text-foreground-muted">
              {owner?.descriptor
                ? `Owner ${owner.descriptor.ownerEnvironmentId ?? "unknown"} · epoch ${owner.descriptor.ownerEpoch ?? "unknown"} · ${owner.freshness}.`
                : "No native owner descriptor is available. Heartbeats remain paused."}
            </Text>
            <Text className="text-xs leading-normal text-foreground-muted">
              Read-only Portfolio status. Transfer and scheduling are not enabled here; open a
              native thread above to message that exact environment through T3.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
