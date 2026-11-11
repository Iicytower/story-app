import { Types } from "mongoose";
import { endOtherSessions } from "@/lib/auth/sessions";
import { connectDB } from "@/lib/db";
import { Activity } from "@/lib/models/activity";
import { Avatar } from "@/lib/models/avatar";
import { Block } from "@/lib/models/block";
import { ChapterContent } from "@/lib/models/chapter-content";
import { CommunityBan } from "@/lib/models/community-ban";
import { CommunityModerator } from "@/lib/models/community-moderator";
import { Conversation } from "@/lib/models/conversation";
import { Cover } from "@/lib/models/cover";
import { DailyStat } from "@/lib/models/daily-stat";
import { Folder } from "@/lib/models/folder";
import { FolderVersion } from "@/lib/models/folder-version";
import { Follow } from "@/lib/models/follow";
import { ForumCategory } from "@/lib/models/forum-category";
import { ForumPost } from "@/lib/models/forum-post";
import { ForumThread } from "@/lib/models/forum-thread";
import { LibraryItem } from "@/lib/models/library-item";
import { Message } from "@/lib/models/message";
import { Notification } from "@/lib/models/notification";
import { Profile } from "@/lib/models/profile";
import { Rating } from "@/lib/models/rating";
import { Reaction } from "@/lib/models/reaction";
import { ReadEvent } from "@/lib/models/read-event";
import { ReaderMark } from "@/lib/models/reader-mark";
import { ReadingProgress } from "@/lib/models/reading-progress";
import { Report } from "@/lib/models/report";
import { Settings } from "@/lib/models/settings";
import { Shelf } from "@/lib/models/shelf";
import { Story } from "@/lib/models/story";
import { ThreadFollow } from "@/lib/models/thread-follow";
import { User } from "@/lib/models/user";
import { purgeSocialData } from "@/lib/social/cascade";

// An interrupted cleanup is taken over by a later request after this long (task 89).
export const CLEANUP_LEASE_MS = 10 * 60 * 1000;

// The tombstone keeps the nickname, so the unique index holds it for good (D37); every
// session ends at once (D75). False when the account was deleted already.
export async function tombstoneAccount(userId: string): Promise<boolean> {
  await connectDB();
  const now = new Date();
  const tombstone = await User.findOneAndUpdate(
    { _id: userId, deletedAt: { $exists: false } },
    {
      $set: { deletedAt: now, cleanupPendingAt: now },
      // The role goes too: admins get the reports of the admin route (task 81).
      $unset: { passwordHash: 1, recoveryCodes: 1, globalBan: 1, role: 1 },
    },
  ).lean();
  if (!tombstone) return false;
  await endOtherSessions(userId, null);
  return true;
}

// The author's own forum goes with the account; its posts in other threads stay (task 89).
// Notifications of its threads stay: the list shows a thread that is gone without a link.
async function purgeAuthorForum(id: Types.ObjectId): Promise<void> {
  const threadIds = (await ForumThread.distinct("_id", {
    authorId: id,
  })) as Types.ObjectId[];
  if (threadIds.length === 0) return;
  const postIds = (await ForumPost.distinct("_id", {
    threadId: { $in: threadIds },
  })) as Types.ObjectId[];
  await Promise.all([
    Reaction.deleteMany({ targetType: "post", targetId: { $in: postIds } }),
    ThreadFollow.deleteMany({ threadId: { $in: threadIds } }),
  ]);
  await ForumPost.deleteMany({ threadId: { $in: threadIds } });
  await ForumThread.deleteMany({ _id: { $in: threadIds } });
}

async function purgeConversations(id: Types.ObjectId): Promise<void> {
  const conversations = await Conversation.find(
    { participantIds: id },
    { participantIds: 1 },
  ).lean();
  if (conversations.length === 0) return;
  const conversationIds = conversations.map(({ _id }) => _id);
  // Mentions in the conversations, by the other party's own index.
  const others = conversations.flatMap(({ participantIds }) =>
    participantIds.filter((participant) => !participant.equals(id)),
  );
  await Promise.all([
    Message.deleteMany({ conversationId: { $in: conversationIds } }),
    Notification.deleteMany({
      userId: { $in: others },
      conversationId: { $in: conversationIds },
    }),
  ]);
  await Conversation.deleteMany({ _id: { $in: conversationIds } });
}

// Every step is idempotent, so a retry runs them all again. The texts' ids are read before
// anything is deleted and their documents go last: a retry after a failure still finds them.
export async function purgeAccountData(userId: string): Promise<void> {
  await connectDB();
  const id = new Types.ObjectId(userId);
  // Soft-deleted texts too: the bin goes with the account.
  const [folderIds, storyIds] = await Promise.all([
    Folder.distinct("_id", { userId: id }) as Promise<Types.ObjectId[]>,
    Story.distinct("_id", { userId: id }) as Promise<Types.ObjectId[]>,
  ]);
  await purgeSocialData({
    folderIds: folderIds.map(String),
    storyIds: storyIds.map(String),
  });
  await Promise.all([
    purgeAuthorForum(id),
    purgeConversations(id),
    Follow.deleteMany({ $or: [{ followerId: id }, { followeeId: id }] }),
    LibraryItem.deleteMany({ userId: id }),
    Shelf.deleteMany({ userId: id }),
    ReadingProgress.deleteMany({ userId: id }),
    ReaderMark.deleteMany({ userId: id }),
    Rating.deleteMany({ userId: id }),
    Reaction.deleteMany({ userId: id }),
    Block.deleteMany({ $or: [{ blockerId: id }, { blockedId: id }] }),
    CommunityBan.deleteMany({ $or: [{ authorId: id }, { userId: id }] }),
    CommunityModerator.deleteMany({ $or: [{ authorId: id }, { userId: id }] }),
    ThreadFollow.deleteMany({ userId: id }),
    ForumCategory.updateMany(
      { moderatorIds: id },
      { $pull: { moderatorIds: id } },
    ),
    Activity.deleteMany({ actorId: id }),
    ReadEvent.deleteMany({ reader: `u:${userId}` }),
    DailyStat.deleteMany({ authorId: id }),
    // Reports of the account's content stay for the moderators: comments and posts remain.
    Report.deleteMany({ reporterId: id }),
    Report.deleteMany({ route: "author", authorId: id }),
    Notification.deleteMany({ userId: id }),
    (async () => {
      await Notification.deleteMany({ actorIds: [id] });
      await Notification.updateMany(
        { actorIds: id },
        { $pull: { actorIds: id } },
      );
    })(),
    Profile.deleteMany({ userId: id }),
    Avatar.deleteMany({ userId: id }),
    Settings.deleteMany({ userId: id }),
  ]);
  const contentIds = (await FolderVersion.distinct("chapters.contentId", {
    folderId: { $in: folderIds },
  })) as string[];
  await ChapterContent.deleteMany({ _id: { $in: contentIds } });
  await FolderVersion.deleteMany({ folderId: { $in: folderIds } });
  await Cover.deleteMany({ userId: id });
  await Story.deleteMany({ userId: id });
  await Folder.deleteMany({ userId: id });
  await User.updateOne({ _id: id }, { $unset: { cleanupPendingAt: 1 } });
}

// Takes over one deleted account whose cleanup stopped, and finishes it.
export async function resumeAccountCleanup(): Promise<string | null> {
  await connectDB();
  const now = new Date();
  const claimed = await User.findOneAndUpdate(
    {
      deletedAt: { $exists: true },
      cleanupPendingAt: { $lt: new Date(now.getTime() - CLEANUP_LEASE_MS) },
    },
    { $set: { cleanupPendingAt: now } },
  )
    .select({ _id: 1 })
    .lean();
  if (!claimed) return null;
  const userId = claimed._id.toString();
  await purgeAccountData(userId);
  return userId;
}
