import { isValidObjectId, Types } from "mongoose";
import type { ValidationError } from "@/lib/action-result";
import { Block } from "@/lib/models/block";
import { CommunityBan } from "@/lib/models/community-ban";
import { CommunityModerator } from "@/lib/models/community-moderator";
import { User } from "@/lib/models/user";

// "reply" is checked against the author of the comment replied to, whose community it is not:
// only bans and blocks of the whole site apply (task 76).
export type InteractionKind =
  | "comment"
  | "reply"
  | "react"
  | "rate"
  | "forumPost"
  | "dm"
  | "follow"
  | "mention";

// A community ban covers taking part in the author's community; the banned user still reads,
// follows and writes direct messages (D80).
const COMMUNITY_KINDS: ReadonlySet<InteractionKind> = new Set([
  "comment",
  "react",
  "rate",
  "forumPost",
]);

export type Permission =
  { ok: true } | (ValidationError & { error: "FORBIDDEN" | "NOT_FOUND" });

type Ban = { until: Date | null } | null | undefined;

export interface InteractionFacts {
  actor: { globalBan?: Ban } | null;
  author: { globalBan?: Ban } | null;
  communityBan: Ban;
  blocked: boolean;
}

export function isBanActive(ban: Ban, now: Date): boolean {
  return !!ban && (ban.until === null || ban.until > now);
}

// One key for every refusal, so the actor cannot tell a ban from a block (D80).
const FORBIDDEN: Permission = {
  ok: false,
  error: "FORBIDDEN",
  key: "interactionNotAllowed",
};
const NOT_FOUND: Permission = {
  ok: false,
  error: "NOT_FOUND",
  key: "userNotFound",
};

export function decideInteraction(
  { actor, author, communityBan, blocked }: InteractionFacts,
  kind: InteractionKind,
  now: Date,
): Permission {
  // A globally banned author's content is hidden from others, so it is not there to act on.
  if (!author || isBanActive(author.globalBan, now)) return NOT_FOUND;
  if (!actor || isBanActive(actor.globalBan, now)) return FORBIDDEN;
  if (blocked) return FORBIDDEN;
  if (COMMUNITY_KINDS.has(kind) && isBanActive(communityBan, now)) {
    return FORBIDDEN;
  }
  return { ok: true };
}

// The only check of whether actorId may take part in authorId's community (D80).
export async function canInteract(
  actorId: string,
  { authorId, kind }: { authorId: string; kind: InteractionKind },
): Promise<Permission> {
  if (!isValidObjectId(authorId)) return NOT_FOUND;
  const self = actorId === authorId;
  const [actor, author, communityBan, block] = await Promise.all([
    User.findById(actorId, { globalBan: 1 }).lean(),
    self ? null : User.findById(authorId, { globalBan: 1 }).lean(),
    self || !COMMUNITY_KINDS.has(kind)
      ? null
      : CommunityBan.findOne(
          { authorId, userId: actorId },
          { until: 1 },
        ).lean(),
    self
      ? null
      : Block.exists({
          $or: [
            { blockerId: authorId, blockedId: actorId },
            { blockerId: actorId, blockedId: authorId },
          ],
        }),
  ]);
  return decideInteraction(
    {
      actor,
      // Acting on one's own content is refused only by one's own global ban.
      author: self ? {} : author,
      communityBan,
      blocked: block !== null,
    },
    kind,
    new Date(),
  );
}

export async function isModeratorOf(
  userId: string,
  authorId: string,
): Promise<boolean> {
  if (!isValidObjectId(authorId)) return false;
  const moderator = await CommunityModerator.exists({
    authorId,
    userId,
    state: "active",
  });
  return moderator !== null;
}

export type ModerationRole = "author" | "moderator";

// The actor's role in authorId's community. A global ban makes the account read-only, which
// takes moderation away too (D80).
export async function moderationRole(
  actorId: string,
  authorId: string,
): Promise<ModerationRole | null> {
  if (!isValidObjectId(authorId)) return null;
  const [actor, moderator] = await Promise.all([
    User.findById(actorId, { globalBan: 1 }).lean(),
    actorId === authorId ? null : isModeratorOf(actorId, authorId),
  ]);
  if (!actor || isBanActive(actor.globalBan, new Date())) return null;
  if (actorId === authorId) return "author";
  return moderator ? "moderator" : null;
}

export interface ModerationFacts {
  role: ModerationRole;
  self: boolean;
  targetIsAuthor: boolean;
  targetIsModerator: boolean;
}

const CANNOT_MODERATE: Permission = {
  ok: false,
  error: "FORBIDDEN",
  key: "cannotModerate",
};

// Nobody moderates themselves or the author; a moderator never moderates another moderator
// (D80). The author hides a moderator's content but bans only after taking the role away.
export function decideModeration(
  { role, self, targetIsAuthor, targetIsModerator }: ModerationFacts,
  action: "hide" | "ban",
): Permission {
  if (self || targetIsAuthor) return CANNOT_MODERATE;
  if (targetIsModerator && (role === "moderator" || action === "ban")) {
    return CANNOT_MODERATE;
  }
  return { ok: true };
}

// Whether actorId, with role in authorId's community, may hide targetId's content or ban them.
export async function canModerate(
  actorId: string,
  { authorId, role, targetId, action }: {
    authorId: string;
    role: ModerationRole;
    targetId: string;
    action: "hide" | "ban";
  },
): Promise<Permission> {
  return decideModeration(
    {
      role,
      self: actorId === targetId,
      targetIsAuthor: authorId === targetId,
      targetIsModerator: await isModeratorOf(targetId, authorId),
    },
    action,
  );
}

// Active moderators of authorId's community, for the controls next to each comment.
export async function moderatorIdsOf(authorId: string): Promise<Set<string>> {
  const moderators = await CommunityModerator.find(
    { authorId, state: "active" },
    { _id: 0, userId: 1 },
  ).lean();
  return new Set(moderators.map(({ userId }) => userId.toString()));
}

// A filter on users for accounts without an active global ban.
export function notGloballyBanned(now: Date) {
  return {
    $nor: [
      { "globalBan.until": null, globalBan: { $exists: true } },
      { "globalBan.until": { $gt: now } },
    ],
  };
}

export function isAdmin(user: { role?: string } | null | undefined): boolean {
  return user?.role === "admin";
}

// Authors whose social content the viewer must not see: blocked by the viewer and globally
// banned accounts (D80). ObjectIds, so the list also works in aggregation pipelines.
// Tombstones of deleted accounts join in task 89.
export async function hiddenUserIdsFor(
  viewerId: string | null,
): Promise<Types.ObjectId[]> {
  const now = new Date();
  const [blocks, banned] = await Promise.all([
    viewerId
      ? Block.find({ blockerId: viewerId }, { _id: 0, blockedId: 1 }).lean()
      : [],
    User.find(
      {
        globalBan: { $exists: true },
        $or: [{ "globalBan.until": null }, { "globalBan.until": { $gt: now } }],
        ...(viewerId ? { _id: { $ne: viewerId } } : {}),
      },
      { _id: 1 },
    ).lean(),
  ]);
  const ids = new Map<string, Types.ObjectId>();
  for (const { blockedId } of blocks) ids.set(blockedId.toString(), blockedId);
  for (const { _id } of banned) ids.set(_id.toString(), _id);
  return [...ids.values()];
}

// One author against hiddenUserIdsFor, without listing every banned account; an author with
// no nickname has no public pages, so is not visible either.
export async function isAuthorVisibleTo(
  viewerId: string,
  authorId: string | Types.ObjectId,
): Promise<boolean> {
  const self = viewerId === authorId.toString();
  const now = new Date();
  const [author, block] = await Promise.all([
    User.exists({
      _id: authorId,
      nickname: { $type: "string" },
      ...(self
        ? {}
        : notGloballyBanned(now)),
    }),
    self ? null : Block.exists({ blockerId: viewerId, blockedId: authorId }),
  ]);
  return author !== null && block === null;
}
