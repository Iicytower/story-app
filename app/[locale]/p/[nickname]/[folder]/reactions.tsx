import { getLocale, getTranslations } from "next-intl/server";
import { isBannedAt } from "@/lib/social/moderation";
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
  const [{ summary, own }, locked] = await Promise.all([
    getChapterReactions(viewerId, storyId),
    isBannedAt(viewerId, { type: "story", id: storyId }),
  ]);
  const t = await getTranslations("reactions");
  const locale = await getLocale();
  return (
    <section id={reactionsAnchor} className="scroll-mt-4">
      <ReactionBar
        target={viewerId ? { type: "story", id: storyId } : null}
        summary={summary}
        own={own}
        locked={locked}
        label={t("chapter")}
        callbackUrl={`/${locale}${path}#${reactionsAnchor}`}
      />
    </section>
  );
}
