import { BookOpen } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { AdultBadge } from "@/components/adult";
import { PublicCover } from "@/components/cover";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Link } from "@/i18n/navigation";
import type { CoverView } from "@/lib/covers/queries";

export interface CardItem {
  path: string;
  title: string;
  byline: string;
  adult: boolean;
  cover: CoverView | null;
  coverAlt: string;
  date?: { iso: string; text: string };
}

// A fixed card width fits the 120px cover; the arrows sit over the cover's middle.
const arrow =
  "top-[5.5rem] inset-y-auto my-0 bg-background/90 shadow-sm disabled:hidden";

export function HomeCarousel({
  id,
  title,
  items,
}: {
  id: string;
  title: string;
  items: CardItem[];
}) {
  const t = useTranslations("home");
  if (items.length === 0) return null;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <h2 id={id} className="text-xl font-semibold">
        {title}
      </h2>
      <Carousel
        opts={{ align: "start", dragFree: true }}
        aria-labelledby={id}
        className="w-full"
      >
        <CarouselContent>
          {items.map((item) => (
            <CarouselItem key={item.path} className="basis-36 sm:basis-40">
              <BookCard item={item} />
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious
          aria-label={t("previous")}
          className={`${arrow} left-2`}
        />
        <CarouselNext aria-label={t("next")} className={`${arrow} right-2`} />
      </Carousel>
    </section>
  );
}

function BookCard({ item }: { item: CardItem }): ReactNode {
  return (
    <Link
      href={item.path}
      className="hover:bg-muted/50 flex min-w-0 flex-col gap-2 rounded-lg p-2 break-words"
    >
      {item.cover ? (
        <PublicCover cover={item.cover} alt={item.coverAlt} size="md" />
      ) : (
        <span className="bg-muted text-muted-foreground flex h-[180px] w-[120px] items-center justify-center rounded-sm border">
          <BookOpen aria-hidden className="size-8" />
        </span>
      )}
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="line-clamp-2 font-medium [overflow-wrap:anywhere]">
          {item.title}
          {item.adult && (
            <span className="ml-1.5 inline-block align-middle">
              <AdultBadge />
            </span>
          )}
        </span>
        <span className="text-muted-foreground line-clamp-2 text-xs [overflow-wrap:anywhere]">
          {item.byline}
        </span>
        {item.date && (
          <time
            dateTime={item.date.iso}
            className="text-muted-foreground text-xs"
          >
            {item.date.text}
          </time>
        )}
      </span>
    </Link>
  );
}
