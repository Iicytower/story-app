import { isObjectIdOrHexString } from "mongoose";
import { coverBytes } from "@/lib/covers/mutations";
import { connectDB } from "@/lib/db";
import { Avatar } from "@/lib/models/avatar";
import { Profile } from "@/lib/models/profile";
import { User } from "@/lib/models/user";
import { requireUser } from "@/lib/auth/session";
import { isBanActive } from "@/lib/social/permissions";

const notFound = () => new Response("Not found", { status: 404 });

// Only the current avatar of a profile; a new id on every upload, so the address never changes
// its image (task 70).
export async function GET(
  _request: Request,
  ctx: RouteContext<"/avatars/[id]">,
) {
  const { id } = await ctx.params;
  if (!isObjectIdOrHexString(id)) return notFound();
  await connectDB();
  const avatar = await Avatar.findById(id)
    .select({ data: 1, userId: 1 })
    .lean();
  if (!avatar) return notFound();
  const current = await Profile.exists({
    userId: avatar.userId,
    avatarId: avatar._id,
  });
  if (!current) return notFound();
  // Hidden from others with the profile while a global ban lasts (D80); a copy cached before the
  // ban stays in the browser.
  const owner = await User.findById(avatar.userId)
    .select({ globalBan: 1 })
    .lean();
  const banned = isBanActive(owner?.globalBan, new Date());
  if (banned) {
    const user = await requireUser();
    if (!user.ok || !avatar.userId.equals(user.userId)) return notFound();
  }

  return new Response(new Uint8Array(coverBytes(avatar.data)), {
    headers: {
      "Content-Type": "image/webp",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": `${banned ? "private" : "public"}, max-age=31536000, immutable`,
    },
  });
}
