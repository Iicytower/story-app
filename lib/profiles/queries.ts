import type { Types } from "mongoose";
import { cache } from "react";
import { findUserByNickname } from "@/lib/accounts";
import { connectDB } from "@/lib/db";
import { Block } from "@/lib/models/block";
import { Follow } from "@/lib/models/follow";
import { Profile } from "@/lib/models/profile";
import { User } from "@/lib/models/user";
import { listLibraryBooks, listShelves } from "@/lib/library/queries";
import { listAuthorBooks } from "@/lib/publish/queries";
import { hiddenUserIdsFor, isBanActive } from "@/lib/social/permissions";

export const avatarPath = (id: string) => `/avatars/${id}`;

export const FOLLOWS_PAGE_SIZE = 50;

export type FollowSide = "followers" | "following";

// The profile's own field and the field of the listed accounts.
const SIDES = {
  followers: { own: "followeeId", other: "followerId" },
  following: { own: "followerId", other: "followeeId" },
} as const;

const hiddenFor = cache(hiddenUserIdsFor);

// Accounts the viewer blocked and globally banned ones are left out of counts and lists alike (D80).
function followFilter(
  userId: Types.ObjectId,
  side: FollowSide,
  hidden: Types.ObjectId[],
) {
  const { own, other } = SIDES[side];
  return { [own]: userId, [other]: { $nin: hidden } };
}

// Accounts without a nickname (D37) have no profile; a globally banned one is hidden from
// everyone but its owner while the ban lasts (D80).
export const getPublicProfile = cache(
  async (nickname: string, viewerId: string | null) => {
    await connectDB();
    const user = await findUserByNickname(nickname);
    if (!user?.nickname) return null;
    const owner = viewerId !== null && user._id.equals(viewerId);
    if (!owner && isBanActive(user.globalBan, new Date())) return null;
    const hidden = await hiddenFor(viewerId);
    const other = viewerId !== null && !owner;
    const [profile, books, followers, following, followed, blocks] =
      await Promise.all([
        Profile.findOne({ userId: user._id })
          .select({ bio: 1, avatarId: 1, libraryPublic: 1 })
          .lean(),
        listAuthorBooks(user._id, user.nickname),
        Follow.countDocuments(followFilter(user._id, "followers", hidden)),
        Follow.countDocuments(followFilter(user._id, "following", hidden)),
        other
          ? Follow.exists({ followerId: viewerId, followeeId: user._id })
          : null,
        other
          ? Block.find(
              {
                $or: [
                  { blockerId: viewerId, blockedId: user._id },
                  { blockerId: user._id, blockedId: viewerId },
                ],
              },
              { _id: 0, blockerId: 1 },
            ).lean()
          : [],
      ]);
    return {
      userId: user._id,
      nickname: user.nickname,
      owner,
      followers,
      following,
      // null for a guest and the owner, who get no Follow button to switch.
      followed: other ? followed !== null : null,
      // null for a guest and the owner, who get no Block button.
      blocking: other
        ? blocks.some(({ blockerId }) => blockerId.toString() === viewerId)
        : null,
      // A block either way hides Follow (task 86).
      blockedEitherWay: blocks.length > 0,
      bio: profile?.bio ?? "",
      avatar: profile?.avatarId
        ? avatarPath(profile.avatarId.toString())
        : null,
      books,
      // A private library is not shown to anyone, the owner included.
      libraryPublic: profile?.libraryPublic ?? true,
    };
  },
);

// Shelves in their order with the books on them; books on no shelf come last.
// Only for a profile whose libraryPublic is true.
export async function getPublicLibrary(
  userId: Types.ObjectId,
  viewerId: string | null,
) {
  const [shelves, books] = await Promise.all([
    listShelves(userId),
    listLibraryBooks(userId, viewerId),
  ]);
  const ids = new Set(shelves.map(({ id }) => id));
  return {
    shelves: shelves
      .map((shelf) => ({
        ...shelf,
        books: books.filter(({ shelfIds }) => shelfIds.includes(shelf.id)),
      }))
      .filter(({ books }) => books.length > 0),
    other: books.filter(({ shelfIds }) => !shelfIds.some((id) => ids.has(id))),
  };
}

export async function myProfilePath(userId: string): Promise<string | null> {
  await connectDB();
  const user = await User.findById(userId).select({ nickname: 1 }).lean();
  return user?.nickname ? `/p/${user.nickname}` : null;
}

// Newest first; one page more is asked for only to know whether there is a next one.
export async function listFollows(
  userId: Types.ObjectId,
  side: FollowSide,
  viewerId: string | null,
  page: number,
) {
  await connectDB();
  const { other } = SIDES[side];
  const rows = await Follow.find(
    followFilter(userId, side, await hiddenFor(viewerId)),
  )
    .sort({ createdAt: -1, _id: -1 })
    .skip((page - 1) * FOLLOWS_PAGE_SIZE)
    .limit(FOLLOWS_PAGE_SIZE + 1)
    .select({ [other]: 1 })
    .lean();
  const ids = rows
    .slice(0, FOLLOWS_PAGE_SIZE)
    .map((row) => row[other] as Types.ObjectId);
  const [users, profiles] = await Promise.all([
    User.find({ _id: { $in: ids }, nickname: { $type: "string" } })
      .select({ nickname: 1 })
      .lean(),
    Profile.find({ userId: { $in: ids }, avatarId: { $exists: true } })
      .select({ userId: 1, avatarId: 1 })
      .lean(),
  ]);
  const nicknames = new Map(users.map((u) => [u._id.toString(), u.nickname]));
  const avatars = new Map(
    profiles.map((p) => [
      p.userId.toString(),
      avatarPath(p.avatarId!.toString()),
    ]),
  );
  // An account deleted in the meantime has no user left to show.
  const accounts = ids.flatMap((id) => {
    const nickname = nicknames.get(id.toString());
    return nickname
      ? [{ nickname, avatar: avatars.get(id.toString()) ?? null }]
      : [];
  });
  return { accounts, hasMore: rows.length > FOLLOWS_PAGE_SIZE };
}
