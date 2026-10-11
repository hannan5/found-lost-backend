import { canTransitionReview, reviewTransitionError } from "./item-transitions";

describe("review status transitions", () => {
  it("follows the CLAUDE.md table", () => {
    expect(canTransitionReview("PENDING_REVIEW", "APPROVED")).toBe(true);
    expect(canTransitionReview("PENDING_REVIEW", "REJECTED")).toBe(true);
    expect(canTransitionReview("REJECTED", "APPROVED")).toBe(true);

    expect(canTransitionReview("PENDING_REVIEW", "RETURNED")).toBe(false);
    expect(canTransitionReview("APPROVED", "RETURNED")).toBe(false); // only via /return
    expect(canTransitionReview("APPROVED", "REJECTED")).toBe(false);
    expect(canTransitionReview("APPROVED", "PENDING_REVIEW")).toBe(false);
    expect(canTransitionReview("RETURNED", "APPROVED")).toBe(false);
    expect(canTransitionReview("REJECTED", "REJECTED")).toBe(false);
  });

  it("explains why a transition was refused", () => {
    expect(reviewTransitionError("APPROVED", "RETURNED")).toMatch(/return action/);
    expect(reviewTransitionError("RETURNED", "APPROVED")).toMatch(/already been returned/);
    expect(reviewTransitionError("APPROVED", "APPROVED")).toMatch(/already has that status/);
    expect(reviewTransitionError("APPROVED", "REJECTED")).toMatch(/only be marked as returned/);
  });
});
