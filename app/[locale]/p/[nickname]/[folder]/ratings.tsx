import { getLocale, getTranslations } from "next-intl/server";
import { isBannedAt } from "@/lib/social/moderation";
import { getRating } from "@/lib/social/rating-summary";
import { ratingAnchor, type RatingTarget } from "@/lib/social/ratings";
import { RatingStars } from "./rating-stars";

// Under a public chapter and on a public book's contents. A guest's page carries no ids.
export async function RatingSection({
  viewerId,
  target,
  path,
}: {
  viewerId: string | null;
  target: { type: RatingTarget; id: string };
  path: string;
}) {
  const [{ summary, own }, locked] = await Promise.all([
    getRating(viewerId, target.type, target.id),
    isBannedAt(viewerId, target),
  ]);
  const t = await getTranslations("ratings");
  const locale = await getLocale();
  return (
    <section id={ratingAnchor} className="scroll-mt-14 md:scroll-mt-4">
      <RatingStars
        target={viewerId ? target : null}
        summary={summary}
        own={own}
        locked={locked}
        label={t(target.type === "story" ? "chapter" : "book")}
        callbackUrl={`/${locale}${path}#${ratingAnchor}`}
      />
    </section>
  );
}
