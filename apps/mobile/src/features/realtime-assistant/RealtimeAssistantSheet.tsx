import type { EnvironmentId, RealtimeContextProvenance } from "@t3tools/contracts";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Modal, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AndroidScreenHeader } from "../../components/AndroidScreenHeader";
import { AppText, AppTextInput } from "../../components/AppText";
import { nativeSpeech } from "../spoken-completions/native";
import {
  createAndroidRealtimePlatform,
  isAndroidRealtimePlatformAvailable,
} from "./nativeRealtimePlatform";
import { RealtimeAssistantController, type RealtimeState } from "./realtimeAssistantController";
import { createOpenAiRealtimeTransport } from "./realtimeAssistantTransport";
import { useRealtimeBootstrap } from "./useRealtimeBootstrap";

const INITIAL_STATE: RealtimeState = {
  status: "idle",
  sessionId: null,
  micMuted: false,
  assistantMuted: false,
  transcript: [],
  error: null,
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

/** A foreground voice session bound to this exact environment/project/thread. */
export function RealtimeAssistantSheet(props: {
  environmentId: EnvironmentId;
  projectId: string;
  threadId: string;
  environmentLabel: string;
  projectTitle: string;
  threadTitle: string;
  messages: ReadonlyArray<{ id: string; role: string; text: string; streaming: boolean }>;
  onClose: () => void;
}) {
  const bootstrap = useRealtimeBootstrap(props.environmentId);
  const insets = useSafeAreaInsets();
  const controller = useRef<RealtimeAssistantController | null>(null);
  const platform = useRef<ReturnType<typeof createAndroidRealtimePlatform> | null>(null);
  const unsubscribe = useRef<(() => void) | null>(null);
  const mounted = useRef(true);
  const contextGeneration = useRef(0);
  const [state, setState] = useState(INITIAL_STATE);
  const [paths, setPaths] = useState("");
  const [selectedMessageId, setSelectedMessageId] = useState<string | undefined>();
  const [speaker, setSpeaker] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [context, setContext] = useState<{
    provenance: RealtimeContextProvenance;
    warnings: ReadonlyArray<string>;
  } | null>(null);
  const available = isAndroidRealtimePlatformAvailable();
  const busy =
    state.status === "starting" || state.status === "active" || state.status === "stopping";
  const documentPaths = paths
    .split(/\r?\n/)
    .map((path) => path.trim())
    .filter(Boolean);
  const choices = props.messages
    .filter(
      (message) => (message.role === "user" || message.role === "assistant") && !message.streaming,
    )
    .slice(-8);
  const stop = useCallback(() => {
    contextGeneration.current += 1;
    setSpeaker(false);
    void controller.current?.stop();
  }, []);

  useEffect(() => {
    mounted.current = true;
    const subscription = AppState.addEventListener("change", (next) => {
      if (next !== "active") stop();
    });
    return () => {
      mounted.current = false;
      subscription.remove();
      unsubscribe.current?.();
      void controller.current?.dispose();
      controller.current = null;
      platform.current = null;
    };
  }, [stop]);

  const start = async () => {
    if (busy || AppState.currentState !== "active") return;
    setStartError(null);
    if (documentPaths.length > 3) {
      setStartError("Choose up to three Markdown plans, one path per line.");
      return;
    }
    try {
      contextGeneration.current += 1;
      if (!controller.current) {
        platform.current = createAndroidRealtimePlatform({ onAudioFocusLost: stop });
        const transport = createOpenAiRealtimeTransport({
          platform: platform.current,
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
        );
        unsubscribe.current = controller.current.subscribe((next) => {
          if (mounted.current) {
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
        ...(selectedMessageId === undefined ? {} : { selectedMessageId }),
        documentPaths,
      });
    } catch {
      if (mounted.current)
        setStartError(
          "Voice could not start. Check microphone permission, the connection and the updated Android app.",
        );
    }
  };
  const close = () => {
    stop();
    props.onClose();
  };

  return (
    <Modal visible animationType="slide" onRequestClose={close}>
      <View className="flex-1 bg-screen" style={{ paddingBottom: insets.bottom }}>
        <AndroidScreenHeader title="Voice assistant" subtitle={props.threadTitle} onBack={close} />
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 16, gap: 16 }}
        >
          <View className="rounded-2xl bg-card p-4 gap-2">
            <AppText className="font-t3-bold">{props.projectTitle}</AppText>
            <AppText className="text-sm text-foreground-muted">
              {props.environmentLabel} · {props.threadTitle}
            </AppText>
            <AppText className="text-sm text-foreground-muted">
              Talk about this thread and its plans. Voice stops when you close this screen or leave
              the app.
            </AppText>
          </View>
          <View className="gap-2">
            <AppText className="font-t3-medium">Plans to include (optional)</AppText>
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
              Up to three project-relative Markdown paths, one per line.
            </AppText>
          </View>
          <View className="gap-2">
            <AppText className="font-t3-medium">Conversation context</AppText>
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
          {!available ? <AppText>Voice requires the updated Android app.</AppText> : null}
          <AppText accessibilityLiveRegion="polite" className="font-t3-medium">
            {state.status === "active"
              ? state.micMuted
                ? "Microphone muted"
                : "Voice active"
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
          {startError || state.error ? (
            <AppText accessibilityLiveRegion="polite">{startError ?? state.error}</AppText>
          ) : null}
          <View className="flex-row flex-wrap gap-2">
            <VoiceButton
              label={busy ? "Stop voice" : "Start voice"}
              disabled={state.status === "stopping" || (!busy && !available)}
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
          {context ? (
            <View className="rounded-2xl bg-card p-4 gap-2">
              <AppText className="font-t3-medium">Included context</AppText>
              <AppText>
                {context.provenance.messageCount} messages · {context.provenance.documents.length}{" "}
                plans
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
          ) : null}
          <View className="gap-3">
            <AppText className="font-t3-medium">Transcript</AppText>
            {!state.transcript.length ? (
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
        </ScrollView>
      </View>
    </Modal>
  );
}
