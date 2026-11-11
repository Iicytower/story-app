import { getLocale, getTranslations } from "next-intl/server";
import { getChapterReactions } from "@/lib/social/reaction-summary";
import { reactionsAnchor } from "@/lib/social/reactions";
import { ReactionBar } from "./reaction-bar";

// Under a public chapter, before its comments.
export async function ChapterReactions({
  viewerId,
  storyId,
  path,
}: {
  viewerId: string | null;
  storyId: string;
  path: string;
}) {
  const { summary, own } = await getChapterReactions(viewerId, storyId);
  const t = await getTranslations("reactions");
  const locale = await getLocale();
  return (
    <section id={reactionsAnchor} className="scroll-mt-4">
      <ReactionBar
        target={viewerId ? { type: "story", id: storyId } : null}
        summary={summary}
        own={own}
        label={t("chapter")}
        callbackUrl={`/${locale}${path}#${reactionsAnchor}`}
      />
    </section>
  );
}
