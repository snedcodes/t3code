import type {
  EnvironmentId,
  PortfolioTask,
  PortfolioTaskStatus,
  PortfolioTaskStatusTransitionRequest,
} from "@t3tools/contracts";

export interface PortfolioTaskStatusCommandInput {
  readonly environmentId: EnvironmentId;
  readonly input: PortfolioTaskStatusTransitionRequest;
}

export function nextPortfolioTaskStatus(status: PortfolioTaskStatus): PortfolioTaskStatus {
  switch (status) {
    case "draft":
      return "ready";
    case "ready":
      return "in_progress";
    case "in_progress":
      return "complete";
    case "blocked":
      return "in_progress";
    case "complete":
      return "ready";
    case "cancelled":
      return "ready";
  }
}

export function makePortfolioTaskStatusCommandInput(
  task: PortfolioTask,
  status: PortfolioTaskStatus,
  updatedAt: string,
): PortfolioTaskStatusCommandInput {
  return {
    environmentId: task.target.environmentId,
    input: {
      taskId: task.taskId,
      target: task.target,
      expectedRevision: task.revision,
      status,
      updatedAt,
    },
  };
}

export function tasksForPortfolioEnvironment(
  tasks: ReadonlyArray<PortfolioTask>,
  environmentId: EnvironmentId,
): ReadonlyArray<PortfolioTask> {
  return tasks.filter((task) => task.target.environmentId === environmentId);
}
