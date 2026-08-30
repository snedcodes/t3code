import {
  IsoDateTime,
  type PortfolioTask,
  type PortfolioTaskStatus,
  type PortfolioTaskStatusTransitionRequest,
} from "@t3tools/contracts";

export function makePortfolioTaskStatusTransitionInput(
  task: PortfolioTask,
  status: PortfolioTaskStatus,
  updatedAt = new Date().toISOString(),
): PortfolioTaskStatusTransitionRequest {
  return {
    taskId: task.taskId,
    target: task.target,
    expectedRevision: task.revision,
    status,
    updatedAt: IsoDateTime.make(updatedAt),
  };
}
