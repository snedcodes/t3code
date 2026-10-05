import { requireOptionalNativeModule } from "expo";
import { AppState, PermissionsAndroid, Platform } from "react-native";
import { uuidv4 } from "../../lib/uuid";
import { RealtimeCallLifetime, type RealtimeCallControl } from "./realtimeCallLifetime";

type CallModule = {
  startRealtimeCall?: (ownerId: string) => Promise<boolean>;
  stopRealtimeCall?: (ownerId: string) => void;
  isRealtimeCallActive?: (ownerId: string) => boolean;
  addListener(
    event: "onRealtimeCallControl",
    listener: (event: RealtimeCallControl) => void,
  ): { remove(): void };
};

export function createNativeRealtimeCall(onEnd: (reason: RealtimeCallControl["reason"]) => void) {
  function module(): CallModule {
    const native =
      Platform.OS === "android"
        ? requireOptionalNativeModule<CallModule>("T3AgentNotifications")
        : null;
    if (
      typeof native?.startRealtimeCall !== "function" ||
      typeof native.stopRealtimeCall !== "function" ||
      typeof native.isRealtimeCallActive !== "function" ||
      typeof native.addListener !== "function"
    ) {
      throw new Error("Background voice requires an updated Android app.");
    }
    return native;
  }
  return new RealtimeCallLifetime({
    identity: uuidv4,
    foreground: () => AppState.currentState === "active",
    async microphonePermission() {
      const permission = PermissionsAndroid.PERMISSIONS.RECORD_AUDIO;
      if (await PermissionsAndroid.check(permission)) return true;
      if (AppState.currentState !== "active") return false;
      return (await PermissionsAndroid.request(permission)) === PermissionsAndroid.RESULTS.GRANTED;
    },
    onEnd,
    native: {
      start: (ownerId) => module().startRealtimeCall!(ownerId),
      stop: (ownerId) => {
        try {
          module().stopRealtimeCall!(ownerId);
        } catch {
          /* Runtime teardown must still release local media. */
        }
      },
      isActive: (ownerId) => {
        try {
          return module().isRealtimeCallActive!(ownerId);
        } catch {
          return false;
        }
      },
      subscribe: (listener) => {
        const subscription = module().addListener("onRealtimeCallControl", listener);
        return () => subscription.remove();
      },
    },
  });
}
