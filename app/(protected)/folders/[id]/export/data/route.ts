import { requireUser } from "@/lib/auth/session";
import type { ExportSource } from "@/lib/export/document";
import { getFolderForExport } from "@/lib/folders/queries";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/folders/[id]/export/data">,
) {
  const user = await requireUser();
  if (!user.ok) return new Response(user.message, { status: 401 });

  const { id } = await ctx.params;
  const folder = await getFolderForExport(user.userId, id);
  if (!folder) return new Response("Not found", { status: 404 });

  const source: ExportSource = {
    kind: "folder",
    title: folder.name,
    notes: folder.notes,
    chapters: folder.chapters.map(({ title, content, notes }) => ({
      title,
      content,
      notes,
    })),
  };
  return Response.json(source, { headers: { "Cache-Control": "no-store" } });
}
