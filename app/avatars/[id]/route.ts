import { isObjectIdOrHexString } from "mongoose";
import { coverBytes } from "@/lib/covers/mutations";
import { connectDB } from "@/lib/db";
import { Avatar } from "@/lib/models/avatar";
import { Profile } from "@/lib/models/profile";

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

  return new Response(new Uint8Array(coverBytes(avatar.data)), {
    headers: {
      "Content-Type": "image/webp",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
