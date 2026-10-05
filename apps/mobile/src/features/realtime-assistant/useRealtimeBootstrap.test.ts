import { expect, it, vi } from "vite-plus/test";
import * as Cause from "effect/Cause";
import { HttpClientError, HttpClientRequest } from "effect/unstable/http";
import {
  RemoteEnvironmentAuthFetchError,
  RemoteEnvironmentAuthTimeoutError,
  RemoteEnvironmentAuthInvalidJsonError,
  RemoteEnvironmentAuthUndeclaredStatusError,
} from "../../../../../packages/client-runtime/src/rpc/http";
import { ConnectionTransientError } from "../../../../../packages/client-runtime/src/connection/model";

vi.mock("@t3tools/client-runtime/state/realtimeHttp", () => ({
  createEnvironmentRealtimeBootstrapCommand: () => ({}),
}));
vi.mock("../../connection/runtime", () => ({ connectionAtomRuntime: {} }));
vi.mock("../../state/use-atom-command", () => ({ useAtomCommand: vi.fn() }));

import { realtimeBootstrapFailure } from "./useRealtimeBootstrap";
import { createOpenAiRealtimeTransport } from "./realtimeAssistantTransport";

it("preserves only typed transient bootstrap causes through the transport recovery boundary", async () => {
  const detail = "private-token-and-provider-detail";
  const timeout = new RemoteEnvironmentAuthTimeoutError("https://private.invalid", 20_000);
  const network = new HttpClientError.HttpClientError({
    reason: new HttpClientError.TransportError({
      request: HttpClientRequest.get("https://private.invalid"),
      cause: detail,
    }),
  });
  const fetchFailure = (cause: unknown) =>
    new RemoteEnvironmentAuthFetchError({ message: detail, cause });
  const transient = [
    timeout,
    fetchFailure(network),
    fetchFailure("environment_not_ready"),
    new ConnectionTransientError({ reason: "timeout", detail }),
    fetchFailure(new ConnectionTransientError({ reason: "network", detail })),
    new RemoteEnvironmentAuthUndeclaredStatusError("https://private.invalid", 504),
  ];
  const terminal = [
    fetchFailure("invalid_realtime_request"),
    fetchFailure("Dpop"),
    fetchFailure({ _tag: "ConnectionBlockedError", reason: "authentication", detail }),
    { _tag: "EnvironmentNotRegisteredError", message: detail },
    { _tag: "EnvironmentAuthInvalidError", reason: "invalid_credential", message: detail },
    { _tag: "EnvironmentRequestInvalidError", message: detail },
    new RemoteEnvironmentAuthInvalidJsonError({
      message: detail,
      cause: "invalid_realtime_response",
    }),
    new RemoteEnvironmentAuthUndeclaredStatusError("https://private.invalid", 401),
    new RemoteEnvironmentAuthUndeclaredStatusError("https://private.invalid", 502),
    new RemoteEnvironmentAuthUndeclaredStatusError("https://private.invalid", 503),
    new ConnectionTransientError({ reason: "remote-unavailable", detail }),
    new Error(detail),
  ];
  for (const error of transient)
    expect(realtimeBootstrapFailure(Cause.fail(error)).reason).toBe("network-failed");
  for (const error of terminal)
    expect(realtimeBootstrapFailure(Cause.fail(error)).reason).toBeUndefined();
  for (const cause of [
    Cause.interrupt(),
    Cause.die(detail),
    Cause.combine(Cause.fail(timeout), Cause.interrupt()),
    Cause.combine(Cause.fail(timeout), Cause.fail(terminal[0])),
  ])
    expect(realtimeBootstrapFailure(cause).reason).toBeUndefined();

  const stop = vi.fn();
  const error = vi.fn();
  const notices = vi.fn();
  const transport = createOpenAiRealtimeTransport({
    bootstrap: async () => {
      throw realtimeBootstrapFailure(Cause.fail(fetchFailure(network)));
    },
    onNotice: notices,
    platform: {
      getUserMedia: async () => ({
        getTracks: () => [{ enabled: true, stop }],
        getAudioTracks: () => [{ enabled: true, stop }],
      }),
      createPeerConnection: () => {
        throw new Error("Must not negotiate a failed bootstrap");
      },
      fetch: async () => {
        throw new Error("Must not request SDP after failed bootstrap");
      },
      playback: { clear() {}, setMuted() {}, setRemoteStream() {} },
    },
  });
  transport.subscribe({ transcript() {}, completed() {}, error, closed() {} });
  await expect(transport.start({ projectId: "project", threadId: "thread" })).rejects.toThrow(
    "Voice environment connection temporarily unavailable.",
  );
  expect(error).toHaveBeenCalledWith(
    "Voice environment connection temporarily unavailable.",
    "network-failed",
  );
  expect(notices).toHaveBeenCalledWith({ kind: "terminal", reason: "network-failed" });
  expect(stop).toHaveBeenCalledOnce();
  expect(JSON.stringify(error.mock.calls)).not.toContain(detail);
  expect(JSON.stringify(error.mock.calls)).not.toContain("private.invalid");
  // The transport's overall deadline can precede the HTTP command's own timeout.
  vi.useFakeTimers();
  const timedOut = vi.fn();
  const pending = createOpenAiRealtimeTransport({
    bootstrap: () => new Promise(() => {}),
    platform: {
      getUserMedia: async () => ({
        getTracks: () => [],
        getAudioTracks: () => [{ enabled: true, stop() {} }],
      }),
      createPeerConnection: () => {
        throw new Error("Bootstrap still pending");
      },
      fetch: async () => {
        throw new Error("Bootstrap still pending");
      },
      playback: { clear() {}, setMuted() {}, setRemoteStream() {} },
    },
  });
  pending.subscribe({ transcript() {}, completed() {}, error: timedOut, closed() {} });
  try {
    const rejected = expect(
      pending.start({ projectId: "project", threadId: "thread" }),
    ).rejects.toThrow("timed out");
    await vi.advanceTimersByTimeAsync(20_000);
    await rejected;
    expect(timedOut).toHaveBeenCalledWith("Realtime session startup timed out.", "network-failed");
  } finally {
    await pending.stop();
    vi.useRealTimers();
  }
});
