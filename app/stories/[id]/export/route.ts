import { requireUser } from "@/lib/auth/session";
import { exportFileName, toMarkdownExport } from "@/lib/stories/export";
import { getStoryForExport } from "@/lib/stories/queries";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/stories/[id]/export">,
) {
  const user = await requireUser();
  if (!user.ok) return new Response(user.message, { status: 401 });

  const { id } = await ctx.params;
  const story = await getStoryForExport(user.userId, id);
  if (!story) return new Response("Not found", { status: 404 });

  return new Response(toMarkdownExport(story), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFileName(story.title)}"`,
      "Cache-Control": "no-store",
    },
  });
}
