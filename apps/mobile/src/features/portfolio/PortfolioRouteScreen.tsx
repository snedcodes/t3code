import { CommandId, MessageId, type EnvironmentId } from "@t3tools/contracts";
import { useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";

import { AppText as Text } from "../../components/AppText";
import { AndroidScreenHeader } from "../../components/AndroidScreenHeader";
import { NativeHeaderToolbar } from "../../native/StackHeader";
import { useThemeColor } from "../../lib/useThemeColor";
import { useEnvironments } from "../../state/environments";
import { useProjects, useThreadShells } from "../../state/entities";
import { usePortfolioHeartbeatOwner } from "../../state/portfolio";
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
  const { environments } = useEnvironments();
  const projects = useProjects();
  const threads = useThreadShells();
  const targets = useMemo(() => toPortfolioTargetList(environments), [environments]);
  const [selectedId, setSelectedId] = useState<EnvironmentId | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [messageDraft, setMessageDraft] = useState("");
  const [messageState, setMessageState] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const selected =
    targets.find((target) => target.environmentId === selectedId) ?? targets[0] ?? null;
  const ownerQuery = usePortfolioHeartbeatOwner(selected?.environmentId ?? null);
  const owner = ownerQuery.data;
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
                      : "Delivery follows this environment’s normal T3 connection."}
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
