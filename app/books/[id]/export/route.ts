import { requireUser } from "@/lib/auth/session";
import { buildFolderZip, folderZipName } from "@/lib/folders/export";
import { coverBytes } from "@/lib/covers/mutations";
import { getFolderForExport } from "@/lib/folders/queries";
import { Cover } from "@/lib/models/cover";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/books/[id]/export">,
) {
  const user = await requireUser();
  if (!user.ok) return new Response(user.message, { status: 401 });

  const { id } = await ctx.params;
  const folder = await getFolderForExport(user.userId, id);
  if (!folder) return new Response("Not found", { status: 404 });

  const cover =
    folder.coverId &&
    (await Cover.findOne({ _id: folder.coverId, state: "rated" })
      .select({ data: 1 })
      .lean());

  return new Response(
    Buffer.from(
      buildFolderZip(
        folder,
        cover ? new Uint8Array(coverBytes(cover.data)) : undefined,
      ),
    ),
    {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${folderZipName(folder.name)}"`,
        "Cache-Control": "no-store",
      },
    },
  );
}
