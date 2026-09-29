/**
 * Multi-environment read-only storage inventory state.
 *
 * Each connected environment measures its own allowlisted roots. The client
 * never supplies a path and never merges this with context-token telemetry.
 *
 * @module state/storageInventory
 */
import { useAtomValue } from "@effect/atom-react";
import type { EnvironmentId, StorageInventory } from "@t3tools/contracts";
import * as Option from "effect/Option";
import { AsyncResult, Atom } from "effect/unstable/reactivity";
import { useCallback } from "react";

import { appAtomRegistry } from "../rpc/atomRegistry";
import { environmentPresentations } from "./presentation";
import { serverEnvironment } from "./server";

export interface EnvironmentStorageInventoryStatus {
  readonly environmentId: EnvironmentId;
  readonly label: string;
  readonly isPending: boolean;
  readonly error: string | null;
  readonly inventory: StorageInventory | null;
}

const storageByEnvironmentAtom = Atom.make((get): readonly EnvironmentStorageInventoryStatus[] => {
  const presentations = get(environmentPresentations.presentationsAtom);
  const statuses: EnvironmentStorageInventoryStatus[] = [];

  for (const [environmentId, presentation] of presentations) {
    const result = get(serverEnvironment.storageInventory({ environmentId, input: {} }));
    statuses.push({
      environmentId,
      label: presentation.entry.target.label,
      isPending: result.waiting,
      error: result._tag === "Failure" ? "This environment could not report storage." : null,
      inventory: Option.getOrNull(AsyncResult.value(result)),
    });
  }

  return statuses;
}).pipe(Atom.withLabel("web-storage-inventory"));

export interface StorageInventoryView {
  readonly environments: readonly EnvironmentStorageInventoryStatus[];
  readonly isPending: boolean;
  readonly refresh: () => void;
}

export function useStorageInventory(): StorageInventoryView {
  const environments = useAtomValue(storageByEnvironmentAtom);
  const refresh = useCallback(() => {
    for (const environment of environments) {
      appAtomRegistry.refresh(
        serverEnvironment.storageInventory({
          environmentId: environment.environmentId,
          input: {},
        }),
      );
    }
  }, [environments]);

  return {
    environments,
    isPending: environments.some((environment) => environment.isPending),
    refresh,
  };
}
