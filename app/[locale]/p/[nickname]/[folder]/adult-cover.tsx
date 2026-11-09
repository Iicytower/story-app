"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { CoverImage, type CoverSize } from "@/components/cover";
import { useRouter } from "@/i18n/navigation";
import { ADULT_COOKIE, ADULT_COOKIE_MAX_AGE } from "@/lib/adult/gate";

// An 18+ cover on the contents and chapter pages stays blurred until the reader confirms their
// age, the same answer as before an 18+ chapter (D67, D69).
export function BlurredCover({
  path,
  alt,
  size,
}: {
  path: string;
  alt: string;
  size: CoverSize;
}) {
  const t = useTranslations("covers");
  const router = useRouter();
  return (
    <div className="relative w-fit shrink-0 overflow-hidden rounded-sm">
      <CoverImage path={path} alt={alt} size={size} className="blur-xl" />
      <div className="absolute inset-0 flex items-center justify-center p-2">
        <Button
          size="sm"
          variant="secondary"
          className="h-auto whitespace-normal"
          onClick={() => {
            document.cookie = `${ADULT_COOKIE}=1; path=/; max-age=${ADULT_COOKIE_MAX_AGE}; samesite=lax`;
            router.refresh();
          }}
        >
          {t("showAdult")}
        </Button>
      </div>
    </div>
  );
}
