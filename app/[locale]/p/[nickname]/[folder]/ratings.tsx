import { getLocale, getTranslations } from "next-intl/server";
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
  const { summary, own } = await getRating(viewerId, target.type, target.id);
  const t = await getTranslations("ratings");
  const locale = await getLocale();
  return (
    <section id={ratingAnchor} className="scroll-mt-4">
      <RatingStars
        target={viewerId ? target : null}
        summary={summary}
        own={own}
        label={t(target.type === "story" ? "chapter" : "book")}
        callbackUrl={`/${locale}${path}#${ratingAnchor}`}
      />
    </section>
  );
}
