import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { Reaction } from "@/lib/models/reaction";
import { Story } from "@/lib/models/story";
import { User } from "@/lib/models/user";
import { hiddenUserIdsFor } from "@/lib/social/permissions";
import {
  REACTIONS,
  REACTORS_SHOWN,
  type ReactionKey,
  type ReactionSummary,
  type ReactionTarget,
} from "@/lib/social/reactions";

// Counts and newest nicknames per reaction of objects the caller already showed as visible.
// Accounts the viewer must not see are left out of both, so the list matches its number (D80).
export async function getReactionSummaries(
  viewerId: string | null,
  targetType: ReactionTarget,
  targetIds: string[],
): Promise<Map<string, ReactionSummary>> {
  if (targetIds.length === 0) return new Map();
  await connectDB();
  const ids = targetIds.map((id) => new Types.ObjectId(id));
  const hidden = await hiddenUserIdsFor(viewerId);
  const [groups, mine] = await Promise.all([
    Reaction.aggregate<{
      _id: { targetId: Types.ObjectId; reaction: ReactionKey };
      count: number;
      userIds: Types.ObjectId[];
    }>([
      {
        $match: {
          targetType,
          targetId: { $in: ids },
          userId: { $nin: hidden },
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: { targetId: "$targetId", reaction: "$reaction" },
          count: { $sum: 1 },
          userIds: { $firstN: { input: "$userId", n: REACTORS_SHOWN } },
        },
      },
    ]),
    viewerId
      ? Reaction.find({ userId: viewerId, targetType, targetId: { $in: ids } })
          .select({ targetId: 1, reaction: 1 })
          .lean()
      : [],
  ]);
  const users = await User.find({
    _id: { $in: groups.flatMap(({ userIds }) => userIds) },
    nickname: { $type: "string" },
  })
    .select({ nickname: 1 })
    .lean();
  const nicknames = new Map(
    users.map(({ _id, nickname }) => [_id.toString(), nickname!]),
  );
  const summaries = new Map<string, ReactionSummary>(
    targetIds.map((id) => [id, { groups: [], mine: null }]),
  );
  for (const reaction of REACTIONS) {
    for (const group of groups) {
      if (group._id.reaction !== reaction) continue;
      summaries.get(group._id.targetId.toString())?.groups.push({
        reaction,
        count: group.count,
        nicknames: group.userIds.flatMap(
          (id) => nicknames.get(id.toString()) ?? [],
        ),
      });
    }
  }
  for (const { targetId, reaction } of mine) {
    const summary = summaries.get(targetId.toString());
    if (summary) summary.mine = reaction;
  }
  return summaries;
}

// The chapter's summary, and whether the viewer wrote it: an author does not react to their text.
export async function getChapterReactions(
  viewerId: string | null,
  storyId: string,
): Promise<{ summary: ReactionSummary; own: boolean }> {
  const [summaries, own] = await Promise.all([
    getReactionSummaries(viewerId, "story", [storyId]),
    viewerId ? Story.exists({ _id: storyId, userId: viewerId }) : null,
  ]);
  return { summary: summaries.get(storyId)!, own: own !== null };
}
