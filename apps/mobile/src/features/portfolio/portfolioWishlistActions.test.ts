import { describe, expect, it } from "vite-plus/test";
import { IsoDateTime, type PortfolioTask, type PortfolioWishlist } from "@t3tools/contracts";
import {
  makePortfolioWishlistCreateInput,
  makePortfolioWishlistPromotionCommandInput,
} from "./portfolioWishlistActions";

const task = {
  taskId: "task-1",
  title: "Task",
  outcome: "Outcome",
  target: { environmentId: "env-1", projectId: "project-1", threadId: "thread-1" },
  status: "ready",
  priority: "normal",
  assignment: { ownerPassportId: null, ownerHost: null },
  checklistItems: [],
  completionCondition: "done",
  planLinks: [],
  evidenceLinks: [],
  createdAt: IsoDateTime.make("2026-08-24T00:00:00.000Z"),
  updatedAt: IsoDateTime.make("2026-08-24T00:00:00.000Z"),
  completedAt: null,
  revision: 2,
  lastReceipt: null,
  heartbeatId: null,
} as unknown as PortfolioTask;
const wishlist = {
  wishlistId: "wishlist-1",
  title: "Idea",
  summary: "Summary",
  status: "idea",
  priority: "normal",
  links: [],
  createdAt: IsoDateTime.make("2026-08-24T00:00:00.000Z"),
  updatedAt: IsoDateTime.make("2026-08-24T00:00:00.000Z"),
  revision: 4,
  promotedTaskId: null,
} as PortfolioWishlist;

describe("mobile Portfolio wishlist actions", () => {
  it("builds canonical create data", () => {
    expect(
      makePortfolioWishlistCreateInput("wishlist-1", "Idea", "Summary", "2026-08-24T01:00:00.000Z")
        .status,
    ).toBe("idea");
  });
  it("promotes to the exact selected Task target", () => {
    expect(
      makePortfolioWishlistPromotionCommandInput(wishlist, task, "2026-08-24T01:00:00.000Z"),
    ).toEqual({
      environmentId: task.target.environmentId,
      input: {
        wishlistId: wishlist.wishlistId,
        expectedRevision: 4,
        promotedTaskId: task.taskId,
        updatedAt: IsoDateTime.make("2026-08-24T01:00:00.000Z"),
      },
    });
  });
});
