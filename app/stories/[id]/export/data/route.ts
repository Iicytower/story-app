import { requireUser } from "@/lib/auth/session";
import type { ExportSource } from "@/lib/export/document";
import { getStoryForExport } from "@/lib/stories/queries";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/stories/[id]/export/data">,
) {
  const user = await requireUser();
  if (!user.ok) return new Response(user.message, { status: 401 });

  const { id } = await ctx.params;
  const story = await getStoryForExport(user.userId, id);
  if (!story) return new Response("Not found", { status: 404 });

  const { title, content, notes } = story;
  const source: ExportSource = {
    kind: "story",
    title,
    notes: "",
    chapters: [{ title, content, notes }],
  };
  return Response.json(source, { headers: { "Cache-Control": "no-store" } });
}
