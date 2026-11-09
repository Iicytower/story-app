import { isObjectIdOrHexString } from "mongoose";
import { requireUser } from "@/lib/auth/session";
import { coverBytes } from "@/lib/covers/mutations";
import { connectDB } from "@/lib/db";
import { Cover } from "@/lib/models/cover";
import { Folder } from "@/lib/models/folder";

const notFound = () => new Response("Not found", { status: 404 });

// A new id on every replacement, so the image never changes under its address (task 26).
export async function GET(
  _request: Request,
  ctx: RouteContext<"/covers/[id]">,
) {
  const { id } = await ctx.params;
  if (!isObjectIdOrHexString(id)) return notFound();
  await connectDB();
  // Pending covers are never served: only the filter's re-encoded image is (fail-closed).
  const cover = await Cover.findOne({ _id: id, state: "rated" })
    .select({ data: 1, userId: 1, folderId: 1 })
    .lean();
  if (!cover) return notFound();
  const folder = await Folder.findOne({
    _id: cover.folderId,
    coverId: cover._id,
    deletedAt: null,
  })
    .select({ published: 1 })
    .lean();
  if (!folder) return notFound();
  const user = await requireUser();
  const owner = user.ok && cover.userId.equals(user.userId);
  if (!owner && !folder.published) return notFound();

  return new Response(new Uint8Array(coverBytes(cover.data)), {
    headers: {
      "Content-Type": "image/webp",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": `${folder.published ? "public" : "private"}, max-age=31536000, immutable`,
    },
  });
}
