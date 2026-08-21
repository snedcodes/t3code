import type {
  ConnectionTarget,
  ConnectionTargetKind,
  EnvironmentConnectionPresentation,
  EnvironmentPresentation,
} from "@t3tools/client-runtime/connection";
import type { EnvironmentId } from "@t3tools/contracts";

/**
 * Stable environment target data for Portfolio surfaces.
 *
 * This is intentionally only a projection of the existing connection
 * catalog. It does not select a transport or create a second environment
 * registry. A future Portfolio action can carry this identity forward when
 * it resolves a project or thread within the selected environment.
 */
export interface PortfolioTargetListItem {
  readonly environmentId: EnvironmentId;
  readonly label: string;
  readonly connectionStatus: EnvironmentConnectionPresentation;
  readonly serverVersion: string | null;
  readonly targetIdentity: PortfolioTargetIdentity;
}

export interface PortfolioTargetIdentity {
  readonly kind: ConnectionTargetKind;
  /** Connection id for persisted connections; environment id for local/relay targets. */
  readonly id: string;
}

export function portfolioTargetIdentity(target: ConnectionTarget): PortfolioTargetIdentity {
  switch (target._tag) {
    case "BearerConnectionTarget":
    case "SshConnectionTarget":
      return { kind: target._tag, id: target.connectionId };
    case "PrimaryConnectionTarget":
    case "RelayConnectionTarget":
      return { kind: target._tag, id: target.environmentId };
  }
}

export function toPortfolioTargetListItem(
  environment: EnvironmentPresentation,
): PortfolioTargetListItem {
  return {
    environmentId: environment.entry.target.environmentId,
    label: environment.entry.target.label,
    connectionStatus: environment.connection,
    serverVersion: environment.serverConfig?.environment.serverVersion ?? null,
    targetIdentity: portfolioTargetIdentity(environment.entry.target),
  };
}

export function toPortfolioTargetList(
  environments: ReadonlyArray<EnvironmentPresentation>,
): ReadonlyArray<PortfolioTargetListItem> {
  return environments.map(toPortfolioTargetListItem);
}
