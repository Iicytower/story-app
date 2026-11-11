import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { Folder } from "@/lib/models/folder";
import { Rating } from "@/lib/models/rating";
import { Story } from "@/lib/models/story";
import { hiddenUserIdsFor } from "@/lib/social/permissions";
import type { RatingSummary, RatingTarget } from "@/lib/social/ratings";

// The count and sum of an object the caller already showed as visible, and the viewer's own
// value. Globally banned raters drop out for everyone alike, so rankings (task 84) agree with the
// page; blocks do not change a number that names nobody.
export async function getRatingSummary(
  viewerId: string | null,
  targetType: RatingTarget,
  targetId: string,
): Promise<RatingSummary> {
  await connectDB();
  const banned = await hiddenUserIdsFor(null);
  const [totals, mine] = await Promise.all([
    Rating.aggregate<{ count: number; sum: number }>([
      {
        $match: {
          targetType,
          targetId: new Types.ObjectId(targetId),
          userId: { $nin: banned },
        },
      },
      {
        $group: { _id: null, count: { $sum: 1 }, sum: { $sum: "$value" } },
      },
    ]),
    viewerId
      ? Rating.findOne({ userId: viewerId, targetType, targetId })
          .select({ value: 1 })
          .lean()
      : null,
  ]);
  return {
    count: totals[0]?.count ?? 0,
    sum: totals[0]?.sum ?? 0,
    mine: mine?.value ?? null,
  };
}

// An author does not rate their own text.
export async function getRating(
  viewerId: string | null,
  targetType: RatingTarget,
  targetId: string,
): Promise<{ summary: RatingSummary; own: boolean }> {
  const owned = { _id: targetId, userId: viewerId };
  const [summary, own] = await Promise.all([
    getRatingSummary(viewerId, targetType, targetId),
    !viewerId
      ? null
      : targetType === "story"
        ? Story.exists(owned)
        : Folder.exists(owned),
  ]);
  return { summary, own: own !== null };
}
