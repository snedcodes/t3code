import type { ScopedThreadRef } from "@t3tools/contracts";

import { useRightPanelStore } from "./rightPanelStore";
import { resolvePathLinkTarget } from "./terminal-links";

interface OpenDiffFilePrimaryActionInput {
  readonly threadRef: ScopedThreadRef | null;
  readonly filePath: string;
  readonly activeCwd: string | undefined;
  readonly openInEditor: (targetPath: string) => void;
}

function normalizeDiffFilePath(filePath: string): string {
  const trimmedPath = filePath.trim();
  return trimmedPath.startsWith("a/") || trimmedPath.startsWith("b/")
    ? trimmedPath.slice(2)
    : trimmedPath;
}

export function openDiffFilePrimaryAction({
  threadRef,
  filePath,
  activeCwd,
  openInEditor,
}: OpenDiffFilePrimaryActionInput): void {
  const normalizedFilePath = normalizeDiffFilePath(filePath);
  if (threadRef) {
    useRightPanelStore.getState().openFile(threadRef, normalizedFilePath);
    return;
  }

  openInEditor(
    activeCwd ? resolvePathLinkTarget(normalizedFilePath, activeCwd) : normalizedFilePath,
  );
}
