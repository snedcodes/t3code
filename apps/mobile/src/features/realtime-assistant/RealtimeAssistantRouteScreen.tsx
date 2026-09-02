import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useNavigation, type StaticScreenProps } from "@react-navigation/native";
import { AppText as Text } from "../../components/AppText";
import { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { RealtimeAssistantController } from "./realtimeAssistantController";
import {
  createNativeRealtimeAudio,
  requestMicrophonePermission,
} from "../../../modules/realtime-audio/src";
import { createOpenAiRealtimeTransport } from "./realtimeAssistantTransport";
import { usePreparedConnection } from "../../state/session";
type Props = StaticScreenProps<{
  readonly environmentId: string;
  readonly threadId: string;
  readonly projectId?: string;
}>;
export function RealtimeAssistantRouteScreen(props: Props) {
  const navigation = useNavigation();
  const [state, setState] = useState<ReturnType<RealtimeAssistantController["getState"]>>();
  const environmentId = useMemo(
    () => EnvironmentId.make(props.route.params.environmentId),
    [props.route.params.environmentId],
  );
  const threadId = useMemo(
    () => ThreadId.make(props.route.params.threadId),
    [props.route.params.threadId],
  );
  const prepared = usePreparedConnection(environmentId);
  const session = useMemo(() => {
    const audio = createNativeRealtimeAudio();
    const controller = new RealtimeAssistantController(
      threadId,
      createOpenAiRealtimeTransport({
        threadId,
        projectId: props.route.params.projectId ?? "",
        bootstrap: async ({ threadId: id, projectId, session: sessionConfig }) => {
          if (prepared === null) throw new Error("Environment is not connected.");
          if (prepared.httpAuthorization?._tag !== "Bearer")
            throw new Error("Realtime voice requires a bearer environment connection.");
          const response = await fetch(
            `${prepared.httpBaseUrl.replace(/\/$/, "")}/v1/realtime/client_secrets`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${prepared.httpAuthorization.token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ threadId: id, projectId, session: sessionConfig }),
            },
          );
          if (!response.ok) throw new Error(`Realtime bootstrap failed (${response.status}).`);
          return (await response.json()) as Record<string, unknown>;
        },
      }),
      audio.player,
    );
    return { audio, controller };
  }, [prepared, props.route.params.projectId, threadId]);
  const { audio, controller } = session;
  const captureStop = useRef<(() => void) | null>(null);
  useEffect(() => {
    const unsubscribe = controller.subscribe(setState);
    return () => {
      captureStop.current?.();
      controller.dispose();
      unsubscribe();
    };
  }, [controller]);
  useEffect(() => {
    if (state?.status === "active" && captureStop.current === null)
      void audio
        .capture((frame) => void controller.submitFrame(frame))
        .then((stop) => {
          captureStop.current = stop;
        })
        .catch((error) =>
          controller.reportError(
            error instanceof Error ? error.message : "Microphone capture unavailable.",
          ),
        );
    else if (state?.status !== "active" && captureStop.current !== null) {
      captureStop.current();
      captureStop.current = null;
    }
  }, [audio, controller, state?.status]);
  const start = async () => {
    if (await requestMicrophonePermission()) await controller.start({ outputModality: "audio" });
  };
  return (
    <ScrollView className="flex-1 bg-screen" contentContainerStyle={{ padding: 24, gap: 16 }}>
      <Text className="text-2xl font-t3-bold text-foreground">Realtime assistant</Text>
      <Text className="text-base text-muted-foreground">Thread {props.route.params.threadId}</Text>
      <Text className="text-base text-muted-foreground">
        {state?.error ?? `Status: ${state?.status ?? "idle"}`}
      </Text>
      <View className="flex-row gap-3">
        <Pressable
          className="rounded-full bg-primary px-5 py-3"
          onPress={() => void (state?.status === "active" ? controller.stop() : start())}
        >
          <Text className="font-t3-bold text-primary-foreground">
            {state?.status === "active" ? "Stop" : "Start voice"}
          </Text>
        </Pressable>
        <Pressable
          className="rounded-full bg-secondary px-5 py-3"
          onPress={() => controller.setMicMuted(!state?.micMuted)}
        >
          <Text className="font-t3-bold text-secondary-foreground">
            {state?.micMuted ? "Unmute mic" : "Mute mic"}
          </Text>
        </Pressable>
        <Pressable
          className="rounded-full bg-secondary px-5 py-3"
          onPress={() => controller.setAssistantMuted(!state?.assistantMuted)}
        >
          <Text className="font-t3-bold text-secondary-foreground">
            {state?.assistantMuted ? "Unmute assistant" : "Mute assistant"}
          </Text>
        </Pressable>
      </View>
      <Pressable onPress={() => navigation.goBack()}>
        <Text className="text-base text-primary">Return to thread</Text>
      </Pressable>
    </ScrollView>
  );
}
