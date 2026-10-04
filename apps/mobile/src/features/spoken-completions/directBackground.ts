import Constants from "expo-constants";
import { requireOptionalNativeModule } from "expo";
import { useEffect, useState } from "react";
import { Platform } from "react-native";

interface DirectCompletionStatus {
  status: string;
  connected: number;
  total: number;
  lastIdentity: string;
  lastReceipt: string;
}

interface DirectCompletionModule {
  configureDirectCompletions(enabled: boolean, scheme: string, connections: string): void;
  getDirectCompletionStatus(): DirectCompletionStatus | null;
  addListener(
    event: "onDirectCompletionStatus",
    listener: (value: DirectCompletionStatus) => void,
  ): { remove(): void };
}

const native =
  Platform.OS === "android"
    ? requireOptionalNativeModule<DirectCompletionModule>("T3AgentNotifications")
    : null;

export const directBackground = {
  available: typeof native?.configureDirectCompletions === "function",
  configure(enabled: boolean, connections: string): void {
    const value = Constants.expoConfig?.scheme;
    const scheme = (Array.isArray(value) ? value[0] : value) ?? "t3code";
    native?.configureDirectCompletions?.(enabled, scheme, connections);
  },
};

export function useDirectCompletionStatus() {
  const [status, setStatus] = useState<DirectCompletionStatus | null>(
    () => native?.getDirectCompletionStatus?.() ?? null,
  );
  useEffect(() => {
    const listener = native?.addListener?.("onDirectCompletionStatus", setStatus);
    return () => listener?.remove();
  }, []);
  return status;
}
