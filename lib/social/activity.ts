import type { Types } from "mongoose";
import { Activity, type ActivityType } from "@/lib/models/activity";
import { User } from "@/lib/models/user";
import { notifyNewChapters } from "@/lib/social/notify";
import { isBanActive } from "@/lib/social/permissions";

type Id = string | Types.ObjectId;

export interface ActivityEvent {
  actorId: Id;
  type: ActivityType;
  folderId?: Id;
  storyIds?: Id[];
  threadId?: Id;
  commentId?: Id;
}

// The only writer of the feed (D80); visibility is checked when it is read.
export async function recordActivity(event: ActivityEvent): Promise<void> {
  await Activity.create(event);
}

// One entry per book however many chapters a publication stamped; none when it stamped nothing,
// so publishing again never repeats an entry. The same goes for the "new chapter" notifications.
// A globally banned author's books are hidden, so neither is made (task 91).
export async function recordChaptersPublished(
  actorId: Id,
  folderId: Id,
  storyIds: Id[],
): Promise<void> {
  if (storyIds.length === 0) return;
  const author = await User.findById(actorId).select({ globalBan: 1 }).lean();
  if (isBanActive(author?.globalBan, new Date())) return;
  await recordActivity({
    actorId,
    type: "chapterPublished",
    folderId,
    storyIds,
  });
  notifyNewChapters(actorId, folderId, storyIds);
}
