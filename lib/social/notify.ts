import { Types } from "mongoose";
import { after } from "next/server";
import { connectDB } from "@/lib/db";
import { Block } from "@/lib/models/block";
import { CommunityModerator } from "@/lib/models/community-moderator";
import { Follow } from "@/lib/models/follow";
import { LibraryItem } from "@/lib/models/library-item";
import { Notification } from "@/lib/models/notification";
import { Settings } from "@/lib/models/settings";
import { User } from "@/lib/models/user";
import { isBanActive } from "@/lib/social/permissions";
import { publishRealtime } from "@/lib/social/realtime";
import {
  ACTORS_KEPT,
  GROUPED_TYPES,
  groupOf,
  MAX_NOTIFICATIONS,
  type NotificationSubject,
  type NotificationType,
  NOTIFY_BATCH,
  objectKey,
} from "@/lib/social/notifications";

type Id = string | Types.ObjectId;

export interface NotifyEvent {
  type: NotificationType;
  // Who caused it: never notified of their own step. Shown by name only where the type allows.
  actorId?: Id;
  authorId?: Id;
  folderId?: Id;
  storyIds?: Id[];
  commentId?: Id;
  conversationId?: Id;
  threadId?: Id;
  postId?: Id;
  count?: number;
}

const toId = (id: Id) => new Types.ObjectId(id.toString());

export function chunks<T>(items: T[], size = NOTIFY_BATCH): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

// The document fields an event sets, apart from the recipient and its actors.
export function notificationFields(event: NotifyEvent) {
  const subject: NotificationSubject = event;
  return {
    type: event.type,
    group: groupOf(event.type),
    objectKey: objectKey(event.type, subject),
    ...(event.authorId && { authorId: toId(event.authorId) }),
    ...(event.folderId && { folderId: toId(event.folderId) }),
    ...(event.storyIds?.length && { storyIds: event.storyIds.map(toId) }),
    ...(event.commentId && { commentId: toId(event.commentId) }),
    ...(event.conversationId && {
      conversationId: toId(event.conversationId),
    }),
    ...(event.threadId && { threadId: toId(event.threadId) }),
    ...(event.postId && { postId: toId(event.postId) }),
  };
}

// Leaves out the actor, a block in either direction and a kind the recipient turned off (D80).
// Moderation reaches everyone: it cannot be turned off, and a block does not stop a ban.
async function recipientsOf(
  userIds: string[],
  event: NotifyEvent,
): Promise<Types.ObjectId[]> {
  const actor = event.actorId?.toString();
  // A deleted account's tombstone gets nothing (task 89).
  const deleted = new Set(
    (
      await User.find({ _id: { $in: userIds }, deletedAt: { $exists: true } })
        .select({ _id: 1 })
        .lean()
    ).map(({ _id }) => _id.toString()),
  );
  const ids = userIds.filter((id) => id !== actor && !deleted.has(id));
  if (ids.length === 0 || groupOf(event.type) === "moderation") {
    return ids.map(toId);
  }
  const [blocks, off] = await Promise.all([
    actor
      ? Block.find({
          $or: [
            { blockerId: actor, blockedId: { $in: ids } },
            { blockerId: { $in: ids }, blockedId: actor },
          ],
        })
          .select({ blockerId: 1, blockedId: 1 })
          .lean()
      : [],
    Settings.find({
      userId: { $in: ids },
      [`notifications.${event.type}`]: false,
    })
      .select({ userId: 1 })
      .lean(),
  ]);
  const excluded = new Set([
    ...blocks.flatMap(({ blockerId, blockedId }) => [
      blockerId.toString(),
      blockedId.toString(),
    ]),
    ...off.map(({ userId }) => userId.toString()),
  ]);
  return ids.filter((id) => !excluded.has(id)).map(toId);
}

// A reaction or rating joins the unread notification of the same object; the same person again
// (e.g. a reaction taken off and given again) does not count twice while they are among the
// actors kept. Without a unique index two parallel first reactions may make two notifications.
// True when it made a new notification.
async function addToGroup(
  userId: Types.ObjectId,
  event: NotifyEvent,
): Promise<boolean> {
  const actor = toId(event.actorId!);
  const fields = notificationFields(event);
  const filter = { userId, objectKey: fields.objectKey, readAt: null };
  if (await Notification.exists({ ...filter, actorIds: actor })) return false;
  const { upsertedCount } = await Notification.updateOne(
    filter,
    {
      $inc: { count: 1 },
      $push: { actorIds: { $each: [actor], $slice: -ACTORS_KEPT } },
      $setOnInsert: fields,
    },
    { upsert: true },
  );
  return upsertedCount === 1;
}

// At most MAX_NOTIFICATIONS per account: the oldest beyond it go (D80). One count for the
// accounts just written to; only those over the limit are read further.
async function trim(userIds: Types.ObjectId[]) {
  const over = await Notification.aggregate<{ _id: Types.ObjectId }>([
    { $match: { userId: { $in: userIds } } },
    { $group: { _id: "$userId", count: { $sum: 1 } } },
    { $match: { count: { $gt: MAX_NOTIFICATIONS } } },
  ]);
  for (const { _id: userId } of over) {
    const extra = await Notification.find({ userId })
      .sort({ updatedAt: -1, _id: -1 })
      .skip(MAX_NOTIFICATIONS)
      .select({ _id: 1 })
      .lean();
    await Notification.deleteMany({
      _id: { $in: extra.map(({ _id }) => _id) },
    });
  }
}

// Writes the notifications at once; callers in actions use notifyLater.
export async function notify(
  userIds: Id | Id[],
  event: NotifyEvent,
): Promise<void> {
  const ids = [
    ...new Set((Array.isArray(userIds) ? userIds : [userIds]).map(String)),
  ];
  if (ids.length === 0) return;
  await connectDB();
  const notified: string[] = [];
  for (const batch of chunks(ids)) {
    const recipients = await recipientsOf(batch, event);
    if (recipients.length === 0) continue;
    // Joining an existing group adds nothing to count against the limit.
    const added: Types.ObjectId[] = [];
    if (GROUPED_TYPES.includes(event.type) && event.actorId) {
      for (const userId of recipients) {
        if (await addToGroup(userId, event)) added.push(userId);
      }
    } else {
      added.push(...recipients);
      const fields = notificationFields(event);
      const actorIds = event.actorId ? [toId(event.actorId)] : [];
      await Notification.bulkWrite(
        recipients.map((userId) => ({
          insertOne: {
            document: {
              userId,
              ...fields,
              actorIds,
              count: event.count ?? 1,
            },
          },
        })),
        { ordered: false },
      );
    }
    if (added.length > 0) await trim(added);
    notified.push(...added.map(String));
  }
  // Open pages ask for their counter at once (task 90); a joined group changes no counter.
  await publishRealtime(notified, { type: "notification" });
}

// After the response (D80): a notification never slows an action down nor fails it, an error
// only goes to the log.
export function notifyLater(
  userIds: Id | Id[] | (() => Promise<Id[]>),
  event: NotifyEvent,
): void {
  after(async () => {
    try {
      await notify(
        typeof userIds === "function" ? await userIds() : userIds,
        event,
      );
    } catch (error) {
      console.error("Notification failed", event.type, error);
    }
  });
}

// One notification per reader for a publication of several chapters, like its feed entry. A
// reader with the book in the library gets that kind, the other followers the followed one.
export function notifyNewChapters(
  authorId: Id,
  folderId: Id,
  storyIds: Id[],
): void {
  if (storyIds.length === 0) return;
  const event = {
    actorId: authorId,
    authorId,
    folderId,
    storyIds,
    count: storyIds.length,
  };
  after(async () => {
    try {
      await connectDB();
      const [owners, followers] = await Promise.all([
        LibraryItem.distinct("userId", { folderId }),
        Follow.distinct("followerId", { followeeId: authorId }),
      ]);
      const inLibrary = new Set(owners.map(String));
      await notify([...inLibrary], { ...event, type: "libraryChapter" });
      await notify(
        followers.map(String).filter((id) => !inLibrary.has(id)),
        { ...event, type: "followedChapter" },
      );
    } catch (error) {
      console.error("Notification failed", "newChapters", error);
    }
  });
}

// Who decides a report of the community (task 80): the author and the moderators, except a
// moderator who is reported or whose fellow moderator is.
export async function reportRecipients(report: {
  authorId?: Types.ObjectId;
  targetUserId: Types.ObjectId;
}): Promise<Types.ObjectId[]> {
  await connectDB();
  if (!report.authorId) {
    // The admins who may decide it (mayDecide): not while globally banned.
    const now = new Date();
    const admins = await User.find({ role: "admin" })
      .select({ _id: 1, globalBan: 1 })
      .lean();
    return admins
      .filter(({ globalBan }) => !isBanActive(globalBan, now))
      .map(({ _id }) => _id);
  }
  const moderators = await CommunityModerator.find({
    authorId: report.authorId,
    state: "active",
  })
    .select({ userId: 1 })
    .lean();
  const reportedModerator = moderators.some(({ userId }) =>
    userId.equals(report.targetUserId),
  );
  return [
    report.authorId,
    ...(reportedModerator ? [] : moderators.map(({ userId }) => userId)),
  ];
}
