import {
  BearerConnectionTarget,
  PrimaryConnectionTarget,
  RelayConnectionTarget,
  SshConnectionTarget,
  type EnvironmentPresentation,
} from "@t3tools/client-runtime/connection";
import { EnvironmentId } from "@t3tools/contracts";
import * as Option from "effect/Option";
import { describe, expect, it } from "vite-plus/test";

import {
  portfolioTargetIdentity,
  toPortfolioTargetList,
  toPortfolioTargetListItem,
} from "./portfolioTargets";

const CONNECTED = {
  phase: "connected" as const,
  error: null,
  traceId: null,
};

function environment(target: EnvironmentPresentation["entry"]["target"]): EnvironmentPresentation {
  return {
    entry: { target, profile: Option.none() },
    connection: CONNECTED,
    serverConfig: null,
  };
}

describe("mobile Portfolio target projection", () => {
  it("keeps environment identity, label, connection state, and target identity explicit", () => {
    const target = new BearerConnectionTarget({
      environmentId: EnvironmentId.make("environment-windows"),
      label: "Windows laptop",
      connectionId: "connection-windows-primary",
    });

    expect(toPortfolioTargetListItem(environment(target))).toEqual({
      environmentId: EnvironmentId.make("environment-windows"),
      label: "Windows laptop",
      connectionStatus: CONNECTED,
      serverVersion: null,
      targetIdentity: {
        kind: "BearerConnectionTarget",
        id: "connection-windows-primary",
      },
    });
  });

  it("uses the environment id when a local or relay target has no connection id", () => {
    const environmentId = EnvironmentId.make("environment-mac");
    const primary = new PrimaryConnectionTarget({
      environmentId,
      label: "Mac",
      httpBaseUrl: "http://127.0.0.1:3773",
      wsBaseUrl: "ws://127.0.0.1:3773/ws",
    });
    const relay = new RelayConnectionTarget({
      environmentId: EnvironmentId.make("environment-vps"),
      label: "VPS",
    });

    expect(portfolioTargetIdentity(primary)).toEqual({
      kind: "PrimaryConnectionTarget",
      id: environmentId,
    });
    expect(portfolioTargetIdentity(relay)).toEqual({
      kind: "RelayConnectionTarget",
      id: EnvironmentId.make("environment-vps"),
    });
  });

  it("uses the persisted SSH connection id and preserves the connection status", () => {
    const target = new SshConnectionTarget({
      environmentId: EnvironmentId.make("environment-vps"),
      label: "VPS over SSH",
      connectionId: "connection-vps-ssh",
    });
    const disconnected = {
      phase: "reconnecting" as const,
      error: "Remote environment is restarting.",
      traceId: "trace-123",
    };

    expect(
      toPortfolioTargetList([
        {
          ...environment(target),
          connection: disconnected,
          serverConfig: {
            environment: {
              environmentId: EnvironmentId.make("environment-vps"),
              label: "Windows VPS",
              platform: { os: "linux", arch: "x64" },
              serverVersion: "0.0.33-alpha",
              capabilities: { repositoryIdentity: true },
            },
          } as EnvironmentPresentation["serverConfig"],
        },
      ]),
    ).toEqual([
      {
        environmentId: EnvironmentId.make("environment-vps"),
        label: "VPS over SSH",
        connectionStatus: disconnected,
        serverVersion: "0.0.33-alpha",
        targetIdentity: {
          kind: "SshConnectionTarget",
          id: "connection-vps-ssh",
        },
      },
    ]);
  });
});
