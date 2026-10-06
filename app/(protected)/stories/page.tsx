import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Input } from "@/components/ui/input";
import { requireUser } from "@/lib/auth/session";
import { listStories } from "@/lib/stories/queries";
import { buildSnippet } from "@/lib/stories/search";

export const metadata: Metadata = { title: "Stories – Story App" };

export default async function StoriesPage({
  searchParams,
}: PageProps<"/stories">) {
  const user = await requireUser();
  if (!user.ok) redirect("/login");

  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim() : "";
  const stories = await listStories(user.userId, query || undefined);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Stories</h1>
      <Form action="/stories" role="search">
        <Input
          key={query}
          name="q"
          type="search"
          defaultValue={query}
          placeholder="Search title and content, press Enter"
          aria-label="Search stories"
        />
      </Form>
      {stories.length === 0 ? (
        <p className="text-muted-foreground">
          {query
            ? `No stories match "${query}".`
            : "No stories yet. Create your first one."}
        </p>
      ) : (
        <ul className="flex flex-col divide-y rounded-lg border">
          {stories.map((story) => {
            const snippet = buildSnippet(story.content, query || undefined);
            return (
              <li key={story.id}>
                <Link
                  href={`/stories/${story.id}`}
                  className="hover:bg-muted/50 flex flex-col gap-1 px-4 py-3"
                >
                  <span className="font-medium">{story.title}</span>
                  <span className="text-muted-foreground line-clamp-2 text-sm">
                    {snippet.before}
                    {snippet.match && (
                      <mark className="text-foreground rounded-sm bg-yellow-200 dark:bg-yellow-500/40">
                        {snippet.match}
                      </mark>
                    )}
                    {snippet.after}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
