import { Types } from "mongoose";
import { isDuplicateKeyError } from "@/lib/db";
import { Block } from "@/lib/models/block";
import { CommunityModerator } from "@/lib/models/community-moderator";
import { Follow } from "@/lib/models/follow";
import { User } from "@/lib/models/user";
import { setConversationClosed } from "@/lib/social/direct-messages";
import { logModeration } from "@/lib/social/moderation";

export const BLOCKED_SHOWN = 200;

type Id = string | Types.ObjectId;

const eitherWay = (a: Id, b: Id) => ({
  $or: [
    { blockerId: a, blockedId: b },
    { blockerId: b, blockedId: a },
  ],
});

// Without transactions (a standalone server in tests): the block is saved first, so
// canInteract refuses from then on; every later step is idempotent and a repeated block
// finishes the steps an interrupted one left (task 86).
export async function applyBlock(blockerId: Id, blockedId: Id): Promise<void> {
  const edge = { blockerId, blockedId };
  await Block.updateOne(edge, { $setOnInsert: edge }, { upsert: true }).catch(
    (error: unknown) => {
      // Two clicks at once: the other request saved the same block.
      if (!isDuplicateKeyError(error)) throw error;
    },
  );
  await Follow.deleteMany({
    $or: [
      { followerId: blockerId, followeeId: blockedId },
      { followerId: blockedId, followeeId: blockerId },
    ],
  });
  await setConversationClosed(blockerId, blockedId, true);
  await endModeration(blockerId, blockedId);
}

// Moderation notifications ignore blocks (task 81), so a block either way ends the role and
// the invitation. Logged as the blocker's own step, without a notification that would tell
// the other side about the block.
async function endModeration(blockerId: Id, blockedId: Id): Promise<void> {
  const relations = await CommunityModerator.find({
    $or: [
      { authorId: blockerId, userId: blockedId },
      { authorId: blockedId, userId: blockerId },
    ],
  }).lean();
  // Logged first: a repeated block may log twice, but an interrupted one never drops the entry.
  for (const relation of relations) {
    const byAuthor = relation.authorId.equals(blockerId);
    await logModeration({
      authorId: relation.authorId,
      actorId: blockerId,
      action: byAuthor
        ? "remove"
        : relation.state === "active"
          ? "resign"
          : "decline",
      targetType: "user",
      targetId: relation.userId,
      targetUserId: relation.userId,
    });
    await CommunityModerator.deleteOne({ _id: relation._id });
  }
}

// Follows stay removed; the conversation opens again only when neither side blocks the other.
export async function liftBlock(blockerId: Id, blockedId: Id): Promise<void> {
  await Block.deleteOne({ blockerId, blockedId });
  if (!(await Block.exists(eitherWay(blockerId, blockedId)))) {
    await setConversationClosed(blockerId, blockedId, false);
  }
}

// The newest BLOCKED_SHOWN with the total; accounts without a nickname left (deleted, task 89)
// are not listed.
export async function listBlocked(
  blockerId: Id,
): Promise<{ nicknames: string[]; total: number }> {
  const [blocks, total] = await Promise.all([
    Block.find({ blockerId }, { _id: 0, blockedId: 1 })
      .sort({ createdAt: -1 })
      .limit(BLOCKED_SHOWN)
      .lean(),
    Block.countDocuments({ blockerId }),
  ]);
  const ids = blocks.map(({ blockedId }) => blockedId);
  const users = await User.find({
    _id: { $in: ids },
    nickname: { $type: "string" },
  })
    .select({ nickname: 1 })
    .lean();
  const nicknames = new Map(users.map((u) => [u._id.toString(), u.nickname]));
  return {
    nicknames: ids.flatMap((id) => nicknames.get(id.toString()) ?? []),
    total,
  };
}
