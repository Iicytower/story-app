import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { Block } from "@/lib/models/block";
import { Notification } from "@/lib/models/notification";
import { NICKNAME_COLLATION, User } from "@/lib/models/user";
import { extractMentions } from "@/lib/social/mention-text";
import { canInteract } from "@/lib/social/permissions";

export const MAX_SUGGESTIONS = 8;

const notBanned = (now: Date) => ({
  $nor: [
    { globalBan: { $exists: true }, "globalBan.until": null },
    { "globalBan.until": { $gt: now } },
  ],
});

type Id = string | Types.ObjectId;

// For a list of texts: which mentions of each one link to a profile, by the nickname's own case.
// One query for the accounts and one for the blocks of the whole list (D80, task 76): an account
// gone, without a nickname, globally banned, hidden from the viewer or blocked either way with
// the writer stays text.
export async function resolveMentions(
  texts: { writerId: Id; body: string }[],
  hidden: Types.ObjectId[],
): Promise<string[][]> {
  const mentions = texts.map(({ body }) => extractMentions(body));
  const nicknames = [...new Set(mentions.flat())];
  if (nicknames.length === 0) return mentions.map(() => []);
  await connectDB();
  const users = await User.find({
    nickname: { $type: "string", $in: nicknames },
    _id: { $nin: hidden },
    ...notBanned(new Date()),
  })
    .collation(NICKNAME_COLLATION)
    .select({ nickname: 1 })
    .lean();
  const byNickname = new Map(
    users.map(({ _id, nickname }) => [
      nickname.toLowerCase(),
      { id: _id, nickname },
    ]),
  );
  const writers = [
    ...new Set(texts.map(({ writerId }) => writerId.toString())),
  ];
  const userIds = users.map(({ _id }) => _id);
  const blocks =
    userIds.length === 0
      ? []
      : await Block.find({
          $or: [
            { blockerId: { $in: writers }, blockedId: { $in: userIds } },
            { blockerId: { $in: userIds }, blockedId: { $in: writers } },
          ],
        })
          .select({ blockerId: 1, blockedId: 1 })
          .lean();
  const blocked = new Set(
    blocks.flatMap(({ blockerId, blockedId }) => [
      `${blockerId.toString()}:${blockedId.toString()}`,
      `${blockedId.toString()}:${blockerId.toString()}`,
    ]),
  );
  return texts.map(({ writerId }, index) =>
    mentions[index].flatMap((written) => {
      const user = byNickname.get(written.toLowerCase());
      if (
        !user ||
        blocked.has(`${writerId.toString()}:${user.id.toString()}`)
      ) {
        return [];
      }
      return [user.nickname];
    }),
  );
}

export interface MentionOptions {
  // An edit: who the text mentioned before is not notified again.
  previous?: string;
  // Notified of the same text otherwise, e.g. by a reply.
  exclude?: Id[];
  // A direct message (task 85): only a party to the conversation.
  only?: Id[];
  // Already notified of this comment: an edit does not notify them twice.
  commentId?: Id;
}

// Who a new text of actorId notifies of a mention: existing accounts canInteract allows (bans and
// blocks, D80), without the actor. Comments (76) now; posts (87) and messages (85, with only)
// call it the same way, through notifyLater.
export async function mentionRecipients(
  actorId: Id,
  body: string,
  { previous, exclude = [], only, commentId }: MentionOptions = {},
): Promise<Types.ObjectId[]> {
  const before = new Set(
    previous === undefined
      ? []
      : extractMentions(previous).map((nickname) => nickname.toLowerCase()),
  );
  const nicknames = extractMentions(body).filter(
    (nickname) => !before.has(nickname.toLowerCase()),
  );
  if (nicknames.length === 0) return [];
  await connectDB();
  const users = await User.find({
    nickname: { $type: "string", $in: nicknames },
  })
    .collation(NICKNAME_COLLATION)
    .select({ _id: 1 })
    .lean();
  const skipped = new Set([actorId, ...exclude].map(String));
  const allowed = only && new Set(only.map(String));
  const candidates = users
    .map(({ _id }) => _id)
    .filter(
      (id) =>
        !skipped.has(id.toString()) && (!allowed || allowed.has(id.toString())),
    );
  const notified = new Set(
    commentId && candidates.length > 0
      ? (
          (await Notification.distinct("userId", {
            commentId,
            userId: { $in: candidates },
          })) as Types.ObjectId[]
        ).map(String)
      : [],
  );
  const checked = await Promise.all(
    candidates
      .filter((id) => !notified.has(id.toString()))
      .map(async (id) => {
        const permission = await canInteract(actorId.toString(), {
          authorId: id.toString(),
          kind: "mention",
        });
        return permission.ok ? [id] : [];
      }),
  );
  return checked.flat();
}

// Candidates read for the suggestions: the blocks are checked among them only, so an account
// with many blocks costs no more. More blocked candidates than this leave fewer suggestions.
const SUGGESTION_CANDIDATES = 50;

// Nicknames starting with prefix (D37: case-insensitive), without the viewer, accounts blocked
// either way and globally banned ones.
export async function findNicknameSuggestions(
  viewerId: string,
  prefix: string,
): Promise<string[]> {
  await connectDB();
  // A range on the nickname index; under its collation it is case-insensitive, and U+FFFF sorts
  // after every character.
  const users = await User.find({
    nickname: { $type: "string", $gte: prefix, $lt: `${prefix}\uffff` },
    _id: { $ne: new Types.ObjectId(viewerId) },
    ...notBanned(new Date()),
  })
    .collation(NICKNAME_COLLATION)
    .sort({ nickname: 1 })
    .limit(SUGGESTION_CANDIDATES)
    .select({ nickname: 1 })
    .lean();
  if (users.length === 0) return [];
  const ids = users.map(({ _id }) => _id);
  const blocks = await Block.find({
    $or: [
      { blockerId: viewerId, blockedId: { $in: ids } },
      { blockerId: { $in: ids }, blockedId: viewerId },
    ],
  })
    .select({ blockerId: 1, blockedId: 1 })
    .lean();
  const blocked = new Set(
    blocks.map(({ blockerId, blockedId }) =>
      (blockerId.equals(viewerId) ? blockedId : blockerId).toString(),
    ),
  );
  return users
    .filter(({ _id }) => !blocked.has(_id.toString()))
    .slice(0, MAX_SUGGESTIONS)
    .map(({ nickname }) => nickname);
}
