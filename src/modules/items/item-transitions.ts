import { type ReviewStatus } from "@prisma/client";

/**
 * FoundItem.reviewStatus transitions reachable through PATCH /status.
 * RETURNED is only reachable through POST /return (see ItemsService.markReturned).
 */
const REVIEW_TRANSITIONS: Readonly<Record<ReviewStatus, readonly ReviewStatus[]>> = {
  PENDING_REVIEW: ["APPROVED", "REJECTED"],
  REJECTED: ["APPROVED"],
  APPROVED: [],
  RETURNED: [],
};

export function canTransitionReview(from: ReviewStatus, to: ReviewStatus): boolean {
  return REVIEW_TRANSITIONS[from].includes(to);
}

/** Human sentence for a 409 when a transition is not allowed. */
export function reviewTransitionError(from: ReviewStatus, to: ReviewStatus): string {
  if (to === "RETURNED") {
    return "Use the return action to mark an item as returned.";
  }
  if (from === "RETURNED") {
    return "This item has already been returned and can no longer be changed.";
  }
  if (from === to) {
    return "This report already has that status.";
  }
  if (from === "APPROVED") {
    return "An approved report can only be marked as returned.";
  }
  return "That status change is not allowed.";
}
