export const RATING_TARGETS = ["story", "folder"] as const;

export type RatingTarget = (typeof RATING_TARGETS)[number];

export const RATING_VALUES = [1, 2, 3, 4, 5] as const;

export const isRatingTarget = (value: unknown): value is RatingTarget =>
  typeof value === "string" &&
  (RATING_TARGETS as readonly string[]).includes(value);

export const isRatingValue = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= 1 &&
  value <= 5;

export const ratingAnchor = "rating";

// Anonymous (D80): no rater is named, not even to the author. sum lets the client move the
// average before the server confirms the reader's own rating.
export interface RatingSummary {
  count: number;
  sum: number;
  mine: number | null;
}

export const ratingAverage = ({ count, sum }: RatingSummary) =>
  count === 0 ? null : sum / count;
