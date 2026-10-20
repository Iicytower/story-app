import { requireUser } from "@/lib/auth/session";
import { buildFolderZip, folderZipName } from "@/lib/folders/export";
import { getFolderForExport } from "@/lib/folders/queries";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/folders/[id]/export">,
) {
  const user = await requireUser();
  if (!user.ok) return new Response(user.message, { status: 401 });

  const { id } = await ctx.params;
  const folder = await getFolderForExport(user.userId, id);
  if (!folder) return new Response("Not found", { status: 404 });

  return new Response(Buffer.from(buildFolderZip(folder)), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${folderZipName(folder.name)}"`,
      "Cache-Control": "no-store",
    },
  });
}
