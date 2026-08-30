import {
  IsoDateTime,
  TrimmedNonEmptyString,
  type EnvironmentId,
  type PortfolioTask,
  type PortfolioWishlist,
  type PortfolioWishlistCreateRequest,
  type PortfolioWishlistPromotionRequest,
} from "@t3tools/contracts";

export interface PortfolioWishlistPromotionCommandInput {
  readonly environmentId: EnvironmentId;
  readonly input: PortfolioWishlistPromotionRequest;
}
export function makePortfolioWishlistCreateInput(
  wishlistId: string,
  title: string,
  summary: string,
  updatedAt: string,
): PortfolioWishlistCreateRequest {
  const timestamp = IsoDateTime.make(updatedAt);
  return {
    wishlistId: TrimmedNonEmptyString.make(wishlistId),
    title: TrimmedNonEmptyString.make(title),
    summary: TrimmedNonEmptyString.make(summary),
    status: "idea",
    priority: "normal",
    links: [],
    createdAt: timestamp,
    updatedAt: timestamp,
    revision: 1,
    promotedTaskId: null,
  };
}

export function makePortfolioWishlistPromotionCommandInput(
  wishlist: PortfolioWishlist,
  task: PortfolioTask,
  updatedAt: string,
): PortfolioWishlistPromotionCommandInput {
  return {
    environmentId: task.target.environmentId,
    input: {
      wishlistId: wishlist.wishlistId,
      expectedRevision: wishlist.revision,
      promotedTaskId: task.taskId,
      updatedAt: IsoDateTime.make(updatedAt),
    },
  };
}
