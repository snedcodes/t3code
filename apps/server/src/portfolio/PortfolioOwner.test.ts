import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";

import { decodeTasks } from "./PortfolioOwner.ts";

const baseTask = {
  taskId: "task-1",
  title: "Retain existing task",
  outcome: "The task remains readable after upgrade",
  target: { environmentId: "environment-1", projectId: "project-1", threadId: "thread-1" },
  status: "in_progress",
  priority: "normal",
  checklistItems: [],
  completionCondition: "The task loads",
  planLinks: [],
  evidenceLinks: [],
  createdAt: "2026-09-28T00:00:00.000Z",
  updatedAt: "2026-09-28T00:00:00.000Z",
  completedAt: null,
  revision: 1,
  lastReceipt: null,
  heartbeatId: null,
};

describe("decodeTasks", () => {
  it.effect("migrates legacy nested assignment ownership while reading", () =>
    Effect.gen(function* () {
      const [task] = yield* decodeTasks(JSON.stringify([{ ...baseTask, assignment: { ownerPassportId: "passport-1", ownerHost: "vps" } }]));

      expect(task?.ownerPassportId).toBe("passport-1");
      expect(task?.ownerHost).toBe("vps");
      expect(task).not.toHaveProperty("assignment");
    }));

  it.effect("preserves current flat ownership fields", () =>
    Effect.gen(function* () {
      const [task] = yield* decodeTasks(JSON.stringify([{ ...baseTask, ownerPassportId: null, ownerHost: "current-host" }]));

      expect(task?.ownerPassportId).toBeNull();
      expect(task?.ownerHost).toBe("current-host");
    }));
});
