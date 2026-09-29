import type { PortfolioTask } from "@t3tools/contracts";

/** The established Portfolio view shape layered over the v0.0.42 owner record. */
export type PortfolioTaskView = Omit<PortfolioTask, "ownerPassportId" | "ownerHost"> & {
  readonly assignment: {
    readonly ownerPassportId: string | null;
    readonly ownerHost: string | null;
  };
};

/** Keep old presentation semantics at this boundary; the canonical owner stays flat. */
export function toPortfolioTaskView(task: PortfolioTask): PortfolioTaskView {
  return {
    ...task,
    assignment: {
      ownerPassportId: task.ownerPassportId,
      ownerHost: task.ownerHost,
    },
  };
}

/** Convert a view edit into a complete revision-checked write for the canonical owner. */
export function fromPortfolioTaskView(task: PortfolioTaskView): PortfolioTask {
  const { assignment, ...record } = task;
  return {
    ...record,
    ownerPassportId: assignment.ownerPassportId,
    ownerHost: assignment.ownerHost,
  };
}

export function updatePortfolioTaskView(
  current: PortfolioTask,
  update: (task: PortfolioTaskView) => PortfolioTaskView,
): PortfolioTask {
  const view = toPortfolioTaskView(current);
  const edited = update(view);
  if (edited.taskId !== current.taskId ||
      edited.target.environmentId !== current.target.environmentId ||
      edited.target.projectId !== current.target.projectId ||
      edited.target.threadId !== current.target.threadId) {
    throw new Error("Portfolio Task identity and native target are immutable.");
  }
  return fromPortfolioTaskView(edited);
}
