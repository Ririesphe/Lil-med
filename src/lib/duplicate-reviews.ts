// Review decisions for duplicate groups. Stored in this browser only
// (localStorage). A decision never changes a product: it only records what the
// administrator decided after looking at a group.

export type ReviewStatus = "open" | "reviewed" | "confirmed" | "dismissed";

export interface ReviewDecision {
  status: Exclude<ReviewStatus, "open">;
  /** ISO date-time of the decision. */
  at: string;
  /** Group members at the time of the decision (keys), for reference. */
  members: string[];
}

const STORAGE_KEY = "lilmed:duplicate-reviews:v1";

export function loadReviews(): Record<string, ReviewDecision> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveReviews(reviews: Record<string, ReviewDecision>): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(reviews));
    return true;
  } catch {
    return false;
  }
}

export const STATUS_LABEL: Record<ReviewStatus, string> = {
  open: "Not reviewed",
  reviewed: "Reviewed",
  confirmed: "Confirmed duplicate",
  dismissed: "Not a duplicate",
};
