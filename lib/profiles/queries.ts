import { cache } from "react";
import { findUserByNickname } from "@/lib/accounts";
import { connectDB } from "@/lib/db";
import { Profile } from "@/lib/models/profile";
import { User } from "@/lib/models/user";
import { listAuthorBooks } from "@/lib/publish/queries";
import { isBanActive } from "@/lib/social/permissions";

export const avatarPath = (id: string) => `/avatars/${id}`;

// Accounts without a nickname (D37) have no profile; a globally banned one is hidden from
// everyone but its owner while the ban lasts (D80).
export const getPublicProfile = cache(
  async (nickname: string, viewerId: string | null) => {
    await connectDB();
    const user = await findUserByNickname(nickname);
    if (!user?.nickname) return null;
    const owner = viewerId !== null && user._id.equals(viewerId);
    if (!owner && isBanActive(user.globalBan, new Date())) return null;
    const [profile, books] = await Promise.all([
      Profile.findOne({ userId: user._id })
        .select({ bio: 1, avatarId: 1 })
        .lean(),
      listAuthorBooks(user._id, user.nickname),
    ]);
    return {
      nickname: user.nickname,
      owner,
      bio: profile?.bio ?? "",
      avatar: profile?.avatarId
        ? avatarPath(profile.avatarId.toString())
        : null,
      books,
    };
  },
);

export async function myProfilePath(userId: string): Promise<string | null> {
  await connectDB();
  const user = await User.findById(userId).select({ nickname: 1 }).lean();
  return user?.nickname ? `/p/${user.nickname}` : null;
}
