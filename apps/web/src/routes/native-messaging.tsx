import { createFileRoute } from "@tanstack/react-router";

import { NativeAgentMessagingPage } from "../components/NativeAgentMessagingPage";

export const Route = createFileRoute("/native-messaging")({
  component: NativeAgentMessagingPage,
});
