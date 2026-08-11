import type { ApprovalRequestId, ProviderApprovalDecision } from "@t3tools/contracts";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { AppText as Text } from "../../components/AppText";
import type { PendingApproval } from "../../lib/threadActivity";
import { PENDING_APPROVAL_ACTIONS } from "./PendingApprovalCardActions";

export interface PendingApprovalCardProps {
  readonly approval: PendingApproval;
  readonly respondingApprovalId: ApprovalRequestId | null;
  readonly onRespond: (
    requestId: ApprovalRequestId,
    decision: ProviderApprovalDecision,
  ) => Promise<unknown>;
}

export function PendingApprovalCard(props: PendingApprovalCardProps) {
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const isResponding = props.respondingApprovalId === props.approval.requestId;

  const respond = (decision: ProviderApprovalDecision) => {
    void props.onRespond(props.approval.requestId, decision);
  };

  return (
    <View
      className="gap-2 rounded-[16px] border border-neutral-200 bg-neutral-100/80 px-3 py-2.5 dark:border-white/6 dark:bg-neutral-900/80"
    >
      <View className="flex-row items-center justify-between gap-2">
        <View className="min-w-0 flex-1">
          <Text className="font-t3-bold text-2xs uppercase tracking-[1px] text-sky-700 dark:text-sky-300">
            Approval needed · {props.approval.requestKind}
          </Text>
          <Text
            className="font-mono text-2xs text-neutral-500 dark:text-neutral-400"
            ellipsizeMode="middle"
            numberOfLines={1}
          >
            Request {props.approval.requestId}
          </Text>
        </View>
        {props.approval.detail ? (
          <Pressable
            accessibilityLabel={
              detailsExpanded ? "Hide approval details" : "Show approval details"
            }
            accessibilityRole="button"
            accessibilityState={{ expanded: detailsExpanded }}
            className="rounded-[10px] px-2 py-1.5 active:bg-neutral-200 dark:active:bg-neutral-800"
            onPress={() => setDetailsExpanded((expanded) => !expanded)}
          >
            <Text className="font-t3-bold text-xs text-sky-700 dark:text-sky-300">
              {detailsExpanded ? "Hide details" : "Details"}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {detailsExpanded && props.approval.detail ? (
        <Text className="font-sans text-xs leading-normal text-neutral-600 dark:text-neutral-400">
          {props.approval.detail}
        </Text>
      ) : null}
      <View accessibilityRole="toolbar" className="flex-row flex-wrap gap-1.5">
        {PENDING_APPROVAL_ACTIONS.map((action, index) => (
          <Pressable
            key={action.key}
            accessibilityLabel={
              index === 0 ? "Proceed with this request" : action.label.replace(" · ", ": ")
            }
            accessibilityRole="button"
            accessibilityState={{ disabled: isResponding }}
            className={`items-center justify-center rounded-[11px] px-3 py-2 ${
              index === 0
                ? "bg-blue-500"
                : index === 2
                  ? "bg-rose-100 dark:bg-rose-500/18"
                  : index === 3
                    ? "border border-neutral-300 dark:border-white/12"
                    : "bg-neutral-200 dark:bg-neutral-800"
            }`}
            disabled={isResponding}
            onPress={() => respond(action.decision)}
          >
            <Text
              className={`text-xs ${
                index === 0
                  ? "font-t3-extrabold text-white"
                  : index === 2
                    ? "font-t3-bold text-rose-700 dark:text-rose-300"
                    : index === 3
                      ? "font-t3-bold text-neutral-600 dark:text-neutral-300"
                      : "font-t3-bold text-neutral-950 dark:text-neutral-50"
              }`}
            >
              {action.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
