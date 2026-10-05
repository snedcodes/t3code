import type { EnvironmentId, RealtimeContextProvenance } from "@t3tools/contracts";
import * as Option from "effect/Option";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AppState, Modal, Pressable, ScrollView, View } from "react-native";
import { GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AndroidScreenHeader } from "../../components/AndroidScreenHeader";
import { AppText, AppTextInput } from "../../components/AppText";
import { SymbolView } from "../../components/AppSymbol";
import { projectEnvironment } from "../../state/projects";
import { useDebouncedValue } from "../../state/queries";
import { useEnvironmentQuery } from "../../state/query";
import { useEnvironmentShellState } from "../../state/shell";
import { nativeSpeech } from "../spoken-completions/native";
import {
  createAndroidRealtimePlatform,
  isAndroidRealtimePlatformAvailable,
} from "./nativeRealtimePlatform";
import { RealtimeAssistantController, type RealtimeState } from "./realtimeAssistantController";
import {
  createOpenAiRealtimeTransport,
  type RealtimeTransportNotice,
} from "./realtimeAssistantTransport";
import { useRealtimeBootstrap } from "./useRealtimeBootstrap";
import { usePortfolioContextTools } from "./usePortfolioContextTools";
import { useRealtimePortfolioAccess } from "./useRealtimePortfolioAccess";
import { realtimeAssistantPreferenceKey } from "./realtimePortfolioPreferences";
import { useRealtimeConversation } from "./useRealtimeConversation";
import { useRealtimeMessageDraft } from "./useRealtimeMessageDraft";
import { RealtimeVoiceCues, voiceAudioFocusStopReason } from "./realtimeVoiceCues";
import { createNativeRealtimeCall } from "./nativeRealtimeCall";
import { playRealtimeVoiceCue, waitForRealtimeVoiceCue } from "./nativeRealtimeVoiceCue";
import { useAssistantSwipe } from "./useAssistantSwipe";

const INITIAL_STATE: RealtimeState = {
  status: "idle",
  sessionId: null,
  micMuted: false,
  assistantMuted: false,
  transcript: [],
  error: null,
};

const TRANSPORT_NOTICE_TEXT: Record<RealtimeTransportNotice["reason"], string> = {
  "response-failed": "That voice response could not finish. Try asking again.",
  "provider-error": "The voice service reported an error. Try asking again.",
  "peer-failed": "Voice stopped because the audio connection failed.",
  "channel-failed": "Voice stopped because the event channel failed.",
  "connection-closed": "The voice connection ended.",
  "startup-failed": "Voice could not establish a session.",
  "session-error": "Voice stopped because session communication failed.",
  "network-failed": "Voice network communication was interrupted.",
};

function VoiceButton(props: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  selected?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: props.disabled ?? false, selected: props.selected ?? false }}
      disabled={props.disabled}
      onPress={props.onPress}
      className={`min-h-12 items-center justify-center rounded-2xl px-4 py-3 ${props.selected ? "bg-subtle" : "bg-card"} ${props.disabled ? "opacity-50" : ""}`}
    >
      <AppText className="font-t3-medium">{props.label}</AppText>
    </Pressable>
  );
}

function VoiceSection(props: { title: string; summary?: string; children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View className="gap-2">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={props.title}
        accessibilityHint={expanded ? "Collapse section" : "Expand section"}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((value) => !value)}
        className="min-h-12 flex-row items-center justify-between gap-2 rounded-2xl bg-card px-4 py-3"
      >
        <View className="flex-1 gap-1">
          <AppText className="font-t3-medium">{props.title}</AppText>
          {props.summary ? (
            <AppText className="text-sm text-foreground-muted">{props.summary}</AppText>
          ) : null}
        </View>
        <SymbolView
          name={expanded ? "chevron.down" : "chevron.right"}
          size={20}
          tintColorClassName="accent-foreground"
          type="monochrome"
        />
      </Pressable>
      {expanded ? props.children : null}
    </View>
  );
}

/** A retained voice call bound to this exact environment/project/thread. */
export function RealtimeAssistantSheet(props: {
  environmentId: EnvironmentId;
  projectId: string;
  threadId: string;
  environmentLabel: string;
  projectTitle: string;
  threadTitle: string;
  messages: ReadonlyArray<{ id: string; role: string; text: string; streaming: boolean }>;
  onClose: () => void;
  openRequest?: number;
  onCallStateChange?: (requested: boolean) => void;
}) {
  const { onCallStateChange } = props;
  const bootstrap = useRealtimeBootstrap(props.environmentId);
  const contextTools = usePortfolioContextTools(props.environmentId);
  const conversation = useRealtimeConversation(
    props.environmentId,
    props.projectId,
    props.threadId,
  );
  const messageDraft = useRealtimeMessageDraft(
    props.environmentId,
    props.projectId,
    props.threadId,
  );
  const call = useRef<ReturnType<typeof createNativeRealtimeCall> | null>(null);
  const [minimizedAtRequest, setMinimizedAtRequest] = useState<number | null>(null);
  const minimized = minimizedAtRequest !== null && minimizedAtRequest === (props.openRequest ?? 0);
  const [focusWarning, setFocusWarning] = useState<string | null>(null);
  const cues = useRef(new RealtimeVoiceCues(playRealtimeVoiceCue));
  const transportEndReason = useRef<string | null>(null);
  const previousStatus = useRef<RealtimeState["status"]>("idle");
  const stopReason = useRef<string | null>(null);
  const [terminalReason, setTerminalReason] = useState<string | null>(null);
  const [voiceWarning, setVoiceWarning] = useState<string | null>(null);
  const [routeWarning, setRouteWarning] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const controller = useRef<RealtimeAssistantController | null>(null);
  const platform = useRef<ReturnType<typeof createAndroidRealtimePlatform> | null>(null);
  const unsubscribe = useRef<(() => void) | null>(null);
  const mounted = useRef(true);
  const contextGeneration = useRef(0);

  const [state, setState] = useState(INITIAL_STATE);
  const [paths, setPaths] = useState("");
  const [planQuery, setPlanQuery] = useState("");
  const portfolioPreference = useRealtimePortfolioAccess(
    realtimeAssistantPreferenceKey(props.environmentId, props.projectId, props.threadId),
  );
  const portfolioAccess = portfolioPreference.enabled;
  const [selectedMessageId, setSelectedMessageId] = useState<string | undefined>();
  const [speaker, setSpeaker] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [context, setContext] = useState<{
    provenance: RealtimeContextProvenance;
    warnings: ReadonlyArray<string>;
  } | null>(null);
  const available = isAndroidRealtimePlatformAvailable();
  const busy =
    preparing ||
    state.status === "starting" ||
    state.status === "reconnecting" ||
    state.status === "active" ||
    state.status === "stopping";
  const documentPaths = paths
    .split(/\r?\n/)
    .map((path) => path.trim())
    .filter(Boolean);
  const shell = useEnvironmentShellState(props.environmentId);
  const workspaceRoot = Option.getOrNull(shell.snapshot)?.projects.find(
    (project) => project.id === props.projectId,
  )?.workspaceRoot;
  const searchQuery = planQuery.trim().slice(0, 256) || ".md";
  const debouncedQuery = useDebouncedValue(searchQuery, 200);
  const planSearch = useEnvironmentQuery(
    workspaceRoot && !busy
      ? projectEnvironment.searchEntries({
          environmentId: props.environmentId,
          input: { cwd: workspaceRoot, query: debouncedQuery, limit: 200, kind: "file" },
        })
      : null,
  );
  const searchingPlans = !busy && (searchQuery !== debouncedQuery || planSearch.isPending);
  const markdownPlans = (planSearch.data?.entries ?? []).filter(
    (entry) => entry.kind === "file" && /\.(md|markdown)$/i.test(entry.path),
  );
  const togglePlan = (path: string) => {
    if (busy) return;
    const selected = documentPaths.includes(path);
    setPaths(
      (selected ? documentPaths.filter((item) => item !== path) : [...documentPaths, path]).join(
        "\n",
      ),
    );
  };
  const choices = props.messages
    .filter(
      (message) => (message.role === "user" || message.role === "assistant") && !message.streaming,
    )
    .slice(-8);
  const stop = useCallback(
    (reason = "Voice stopped by you.") => {
      stopReason.current = reason;
      contextGeneration.current += 1;
      setSpeaker(false);
      setFocusWarning(null);
      cues.current.stop();
      call.current?.end();
      onCallStateChange?.(false);
      void controller.current?.stop();
    },
    [onCallStateChange],
  );

  useEffect(() => {
    mounted.current = true;
    return () => {
      cues.current.stop();
      mounted.current = false;
      call.current?.end();
      unsubscribe.current?.();
      void controller.current?.dispose();
      controller.current = null;
      platform.current = null;
    };
  }, []);

  const start = async () => {
    if (
      busy ||
      !portfolioPreference.ready ||
      !conversation.ready ||
      AppState.currentState !== "active"
    )
      return;
    stopReason.current = null;
    transportEndReason.current = null;
    setTerminalReason(null);
    setVoiceWarning(null);
    setFocusWarning(null);
    setStartError(null);
    setRouteWarning(null);
    setPreparing(true);
    onCallStateChange?.(true);
    contextGeneration.current += 1;
    const startGeneration = contextGeneration.current;
    try {
      if (
        !(await conversation.load()) ||
        !mounted.current ||
        startGeneration !== contextGeneration.current ||
        AppState.currentState !== "active"
      )
        return;
      call.current ??= createNativeRealtimeCall((reason) =>
        stop(
          reason === "user-stop"
            ? "Voice ended from the notification."
            : "Voice ended because the Android call service stopped.",
        ),
      );
      await call.current.start();
      if (!mounted.current || startGeneration !== contextGeneration.current) return;
      if (!controller.current) {
        platform.current = createAndroidRealtimePlatform({
          beforeReleaseAudio: waitForRealtimeVoiceCue,
          onAudioFocusLost: (eventCode) => {
            if (mounted.current) setFocusWarning(voiceAudioFocusStopReason(eventCode));
          },
          onAudioFocusRestored: () => {
            if (mounted.current) setFocusWarning(null);
          },
          onBluetoothPermissionDenied: () => {
            if (mounted.current)
              setRouteWarning(
                "Bluetooth permission was denied. Automatic routing can use the handset or wired headset; Bluetooth routing is unavailable.",
              );
          },
        });
        const transport = createOpenAiRealtimeTransport({
          platform: platform.current,
          contextTools,
          messageTools: messageDraft.tools,
          onCompleted: conversation.completed,
          onNotice: (notice) => {
            if (!mounted.current) return;
            if (notice.kind === "warning") {
              setVoiceWarning(TRANSPORT_NOTICE_TEXT[notice.reason]);
            } else {
              transportEndReason.current = TRANSPORT_NOTICE_TEXT[notice.reason];
              setTerminalReason(stopReason.current ?? transportEndReason.current);
              setVoiceWarning(null);
            }
          },
          bootstrap: async (request) => {
            const generation = contextGeneration.current;
            const result = await bootstrap(request);
            if (
              mounted.current &&
              generation === contextGeneration.current &&
              controller.current?.getState().status === "starting"
            ) {
              setContext({ provenance: result.context, warnings: result.warnings });
            }
            return result;
          },
        });
        controller.current = new RealtimeAssistantController(
          { projectId: props.projectId, threadId: props.threadId },
          transport,
          {
            beforeReconnect: async (signal) => {
              if (!call.current) throw new Error("Android background-call service is unavailable.");
              await call.current.beforeReconnect(signal);
            },
            onCallIntentChanged: (requested) => {
              onCallStateChange?.(requested);
              if (!requested) {
                call.current?.end();
                cues.current.stop();
                if (mounted.current) setFocusWarning(null);
              }
            },
          },
        );
        unsubscribe.current = controller.current.subscribe((next) => {
          cues.current.update(next);
          if (mounted.current) {
            if (next.status === "reconnecting") {
              setTerminalReason(null);
              setVoiceWarning(
                "The voice connection was interrupted. Reconnecting; End call remains available.",
              );
            } else if (next.status === "active" && previousStatus.current === "reconnecting") {
              transportEndReason.current = null;
              setVoiceWarning(null);
            } else if (next.status === "stopped") {
              setTerminalReason(
                stopReason.current ?? transportEndReason.current ?? "Voice connection ended.",
              );
            }
            previousStatus.current = next.status;
            setState(next);
            if (next.status === "stopped" || next.status === "error") setSpeaker(false);
          }
        });
      }
      nativeSpeech.stop();
      setContext(null);
      setSpeaker(false);
      platform.current?.setSpeakerphone(false);
      await controller.current.start({
        portfolioAccess,
        ...(selectedMessageId === undefined ? {} : { selectedMessageId }),
        documentPaths,
      });
    } catch {
      if (mounted.current && startGeneration === contextGeneration.current)
        setStartError(
          "Voice could not start. Check microphone permission, the connection and the updated Android background-call app.",
        );
    } finally {
      const status = controller.current?.getState().status;
      if (status !== "active" && status !== "starting" && status !== "reconnecting") {
        call.current?.end();
        onCallStateChange?.(false);
      }
      if (mounted.current) setPreparing(false);
    }
  };
  const close = () => {
    if (busy) {
      setMinimizedAtRequest(props.openRequest ?? 0);
      return;
    }
    void conversation.retry();
    props.onClose();
  };
  const returnSwipe = useAssistantSwipe({ enabled: true, direction: "left", onSwipe: close });

  return (
    <>
      {minimized ? (
        <View
          className="z-50 rounded-2xl bg-card p-4 gap-2"
          style={{ position: "absolute", left: 16, right: 16, bottom: insets.bottom + 12 }}
        >
          <AppText className="font-t3-medium">
            {props.threadTitle}: {busy ? "Voice call ongoing" : "Voice stopped"}
          </AppText>
          <View className="flex-row gap-2">
            <VoiceButton label="Resume voice panel" onPress={() => setMinimizedAtRequest(null)} />
            {busy ? (
              <VoiceButton label="End call" onPress={() => stop()} />
            ) : (
              <VoiceButton label="Close" onPress={close} />
            )}
          </View>
        </View>
      ) : null}
      <Modal visible={!minimized} animationType="slide" onRequestClose={close}>
        <GestureHandlerRootView style={{ flex: 1 }} onLayout={returnSwipe.onLayout}>
          <GestureDetector gesture={returnSwipe.gesture}>
            <View className="flex-1 bg-screen" style={{ paddingBottom: insets.bottom }}>
              <AndroidScreenHeader
                title="Voice assistant"
                subtitle={props.threadTitle}
                onBack={close}
              />
              <View className="gap-2 px-4 py-3">
                <AppText accessibilityLiveRegion="polite" className="font-t3-medium">
                  {preparing
                    ? "Preparing voice..."
                    : state.status === "active"
                      ? state.micMuted
                        ? "Microphone muted"
                        : "Voice active"
                      : state.status === "reconnecting"
                        ? "Reconnecting voice..."
                        : state.status === "starting"
                          ? "Connecting…"
                          : state.status === "stopping"
                            ? "Stopping…"
                            : state.status === "error"
                              ? "Voice stopped"
                              : state.status === "stopped"
                                ? "Stopped"
                                : "Ready"}
                </AppText>
                <AppText className="text-sm text-foreground-muted">
                  Audio route: {speaker ? "Speaker" : "Automatic / earpiece or headphones"}
                </AppText>
                <View className="flex-row flex-wrap gap-2">
                  <VoiceButton
                    label={busy ? "End call" : "Start voice"}
                    disabled={
                      state.status === "stopping" ||
                      (!busy && (!available || !portfolioPreference.ready || !conversation.ready))
                    }
                    onPress={() => {
                      if (busy) stop();
                      else void start();
                    }}
                  />
                  <VoiceButton
                    label={state.micMuted ? "Unmute microphone" : "Mute microphone"}
                    disabled={!busy}
                    selected={state.micMuted}
                    onPress={() => controller.current?.setMicMuted(!state.micMuted)}
                  />
                  <VoiceButton
                    label={state.assistantMuted ? "Unmute assistant" : "Mute assistant"}
                    disabled={!busy}
                    selected={state.assistantMuted}
                    onPress={() => controller.current?.setAssistantMuted(!state.assistantMuted)}
                  />
                  <VoiceButton
                    label="Interrupt"
                    disabled={state.status !== "active"}
                    onPress={() => controller.current?.interrupt()}
                  />
                  <VoiceButton
                    label={speaker ? "Use handset / headset" : "Use speaker"}
                    disabled={state.status !== "active"}
                    selected={speaker}
                    onPress={() => {
                      try {
                        platform.current?.setSpeakerphone(!speaker);
                        setSpeaker(!speaker);
                      } catch {
                        setStartError("Could not change the audio route.");
                      }
                    }}
                  />
                </View>
                {terminalReason && (state.status === "stopped" || state.status === "error") ? (
                  <AppText accessibilityLiveRegion="polite">{terminalReason}</AppText>
                ) : null}
                {focusWarning ? (
                  <AppText accessibilityLiveRegion="polite">{focusWarning}</AppText>
                ) : null}
                {voiceWarning ? (
                  <AppText accessibilityLiveRegion="polite">{voiceWarning}</AppText>
                ) : null}
                {routeWarning ? (
                  <AppText accessibilityLiveRegion="polite">{routeWarning}</AppText>
                ) : null}
                {messageDraft.error ? (
                  <AppText accessibilityLiveRegion="polite">{messageDraft.error}</AppText>
                ) : null}
                {startError || state.error ? (
                  <AppText accessibilityLiveRegion="polite">{startError ?? state.error}</AppText>
                ) : null}
                {portfolioPreference.error ? (
                  <AppText accessibilityLiveRegion="polite">{portfolioPreference.error}</AppText>
                ) : null}
                {!available ? <AppText>Voice requires the updated Android app.</AppText> : null}
                {conversation.error ? (
                  <View className="gap-2">
                    <AppText accessibilityLiveRegion="polite">{conversation.error}</AppText>
                    <VoiceButton
                      label="Retry conversation"
                      onPress={() => {
                        void conversation.load();
                      }}
                    />
                  </View>
                ) : null}
                {!conversation.history && !conversation.error ? (
                  <AppText>Loading saved conversation…</AppText>
                ) : null}
                {conversation.delivery.error ? (
                  <View className="gap-2">
                    <AppText accessibilityLiveRegion="polite">
                      {conversation.delivery.error}
                    </AppText>
                    <VoiceButton
                      label={`Retry ${conversation.delivery.pending} unsaved messages`}
                      onPress={() => {
                        void conversation.retry();
                      }}
                    />
                  </View>
                ) : null}
              </View>
              <ScrollView
                className="flex-1"
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ padding: 16, gap: 16 }}
              >
                <View className="rounded-2xl bg-card p-4 gap-2">
                  <AppText className="font-t3-bold">{props.projectTitle}</AppText>
                  <AppText className="text-sm text-foreground-muted">
                    {props.environmentLabel} · {props.threadTitle}
                  </AppText>
                  <AppText className="text-sm text-foreground-muted">
                    Talk about this thread and its plans. Voice continues when minimized or the app
                    is in the background. Tap End call to disconnect.
                  </AppText>
                </View>
                <View className="gap-2">
                  <VoiceButton
                    label={
                      !portfolioPreference.ready
                        ? portfolioPreference.saving
                          ? "Saving access…"
                          : "Loading access…"
                        : portfolioAccess
                          ? "Portfolio access: On"
                          : "Portfolio access: Off"
                    }
                    selected={portfolioAccess}
                    disabled={busy || !portfolioPreference.ready}
                    onPress={() => {
                      if (busy) stop();
                      portfolioPreference.setEnabled(!portfolioAccess);
                    }}
                  />
                  <AppText className="text-sm text-foreground-muted">
                    Let voice read projects, threads, files and Portfolio across connected
                    environments. Stop voice before changing access, then start again. Your choice
                    is saved for this assistant.
                  </AppText>
                </View>
                <View className="gap-2">
                  <AppText className="font-t3-medium">Message to main coding thread</AppText>
                  <AppText className="text-sm text-foreground-muted">
                    {props.threadTitle}. Unsent drafts last only while this panel is open; the main
                    composer is unchanged. Sending queues the message; it does not confirm an agent
                    reply.
                  </AppText>
                  {messageDraft.draft ? (
                    <>
                      <AppTextInput
                        accessibilityLabel="Voice message draft"
                        multiline
                        maxLength={60000}
                        editable={messageDraft.draft.status !== "sending"}
                        value={messageDraft.draft.text}
                        onChangeText={(text) => messageDraft.tools.edit(text)}
                        className="min-h-24 rounded-2xl bg-card p-4"
                      />
                      <AppText accessibilityLiveRegion="polite">
                        {messageDraft.draft.status === "queued"
                          ? "Queued in the main thread outbox"
                          : messageDraft.draft.status === "sending"
                            ? "Saving to outbox..."
                            : "Draft (not sent)"}
                      </AppText>
                      <View className="flex-row flex-wrap gap-2">
                        <VoiceButton
                          label="Send"
                          disabled={
                            messageDraft.draft.status !== "draft" || !messageDraft.draft.text.trim()
                          }
                          onPress={() => {
                            if (messageDraft.draft)
                              void messageDraft.tools.send({ draftId: messageDraft.draft.draftId });
                          }}
                        />
                        <VoiceButton
                          label={
                            messageDraft.draft.status === "queued"
                              ? "Clear draft view"
                              : "Discard draft"
                          }
                          disabled={messageDraft.draft.status === "sending"}
                          onPress={() => messageDraft.tools.discard()}
                        />
                      </View>
                    </>
                  ) : (
                    <AppText className="text-sm text-foreground-muted">
                      Ask voice to draft a message, then say 'send it' or tap Send.
                    </AppText>
                  )}
                </View>
                <VoiceSection title="Plans" summary={`${documentPaths.length} selected`}>
                  <View className="gap-2">
                    <AppTextInput
                      accessibilityLabel="Search project Markdown plans"
                      value={planQuery}
                      onChangeText={setPlanQuery}
                      editable={!busy && Boolean(workspaceRoot)}
                      autoCapitalize="none"
                      autoCorrect={false}
                      maxLength={256}
                      placeholder="Search Markdown plans"
                    />
                    {!workspaceRoot ? (
                      <AppText className="text-sm text-foreground-muted">
                        Project files are unavailable. You can still enter paths below.
                      </AppText>
                    ) : !busy && searchingPlans ? (
                      <AppText className="text-sm text-foreground-muted">Searching plans…</AppText>
                    ) : !busy && planSearch.error ? (
                      <AppText className="text-sm text-foreground-muted">
                        Could not search project files. You can still enter paths below.
                      </AppText>
                    ) : !busy ? (
                      <>
                        {markdownPlans.slice(0, 20).map((entry) => (
                          <VoiceButton
                            key={entry.path}
                            label={entry.path}
                            selected={documentPaths.includes(entry.path)}
                            onPress={() => togglePlan(entry.path)}
                          />
                        ))}
                        {!markdownPlans.length ? (
                          <AppText className="text-sm text-foreground-muted">
                            No matching Markdown plans. Try a filename or enter a path below.
                          </AppText>
                        ) : null}
                        {planSearch.data?.truncated || markdownPlans.length > 20 ? (
                          <AppText className="text-sm text-foreground-muted">
                            More files are available. Refine your search.
                          </AppText>
                        ) : null}
                      </>
                    ) : null}
                    <AppTextInput
                      accessibilityLabel="Project-relative Markdown plan paths"
                      value={paths}
                      onChangeText={setPaths}
                      editable={!busy}
                      multiline
                      numberOfLines={3}
                      autoCapitalize="none"
                      autoCorrect={false}
                      placeholder="docs/plan.md"
                    />
                    <AppText className="text-sm text-foreground-muted">
                      Project-relative Markdown paths, one per line.
                    </AppText>
                  </View>
                </VoiceSection>
                <VoiceSection
                  title="Recent thread context"
                  summary={selectedMessageId === undefined ? "Recent history" : "Selected message"}
                >
                  <View className="gap-2">
                    <VoiceButton
                      label="Recent thread history"
                      selected={selectedMessageId === undefined}
                      disabled={busy}
                      onPress={() => setSelectedMessageId(undefined)}
                    />
                    {choices.map((message) => (
                      <VoiceButton
                        key={message.id}
                        label={`${message.role === "user" ? "You" : "Agent"}: ${message.text.slice(0, 120)}`}
                        selected={selectedMessageId === message.id}
                        disabled={busy}
                        onPress={() => setSelectedMessageId(message.id)}
                      />
                    ))}
                  </View>
                </VoiceSection>
                <VoiceSection
                  title="Included context / warnings"
                  summary={context ? `${context.warnings.length} warnings` : undefined}
                >
                  {context ? (
                    <View className="rounded-2xl bg-card p-4 gap-2">
                      <AppText>
                        {context.provenance.messageCount} messages ·{" "}
                        {context.provenance.documents.length} plans
                      </AppText>
                      <AppText className="text-sm text-foreground-muted">
                        {context.provenance.tasksLoaded
                          ? `${context.provenance.tasks.length} tasks included${context.provenance.tasksTruncated ? " (clipped)" : ""}`
                          : "Task context unavailable"}
                      </AppText>
                      {context.provenance.documents.map((document) => (
                        <AppText key={document.path} className="text-sm">
                          {document.title} · {document.path}
                          {document.truncated ? " (clipped)" : ""}
                        </AppText>
                      ))}
                      {context.warnings.map((warning) => (
                        <AppText key={warning} className="text-sm text-foreground-muted">
                          {warning}
                        </AppText>
                      ))}
                    </View>
                  ) : (
                    <AppText className="text-sm text-foreground-muted">
                      Included context appears after voice starts.
                    </AppText>
                  )}
                </VoiceSection>
                <VoiceSection
                  title="Transcript"
                  summary={`${(conversation.history?.messages.length ?? 0) + state.transcript.length} messages`}
                >
                  <View className="gap-3">
                    {conversation.history?.messages.map((item) => (
                      <View key={`saved-${item.id}`} className="rounded-2xl bg-card p-4 gap-1">
                        <AppText className="text-sm font-t3-medium">
                          {item.role === "user" ? "You" : "Assistant"}
                        </AppText>
                        <AppText selectable>{item.text}</AppText>
                      </View>
                    ))}
                    {!state.transcript.length && !conversation.history?.messages.length ? (
                      <AppText className="text-sm text-foreground-muted">
                        Your conversation will appear here.
                      </AppText>
                    ) : null}
                    {state.transcript.map((item) => (
                      <View key={item.id} className="rounded-2xl bg-card p-4 gap-1">
                        <AppText className="text-sm font-t3-medium">
                          {item.role === "user" ? "You" : "Assistant"}
                        </AppText>
                        <AppText selectable>{item.text}</AppText>
                      </View>
                    ))}
                  </View>
                </VoiceSection>
              </ScrollView>
            </View>
          </GestureDetector>
        </GestureHandlerRootView>
      </Modal>
    </>
  );
}
