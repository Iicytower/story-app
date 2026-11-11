import { getLocale, getTranslations } from "next-intl/server";
import type { BanNotice } from "@/lib/social/moderation";

// Only the banned account sees it, with the reason and the end of the ban (D80).
export async function CommunityBanNotice({ ban }: { ban: BanNotice | null }) {
  if (!ban) return null;
  const t = await getTranslations("moderation");
  const locale = await getLocale();
  const date = (value: string) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(new Date(value));
  return (
    <div
      role="note"
      aria-labelledby="community-ban-title"
      className="border-destructive/40 bg-destructive/5 flex min-w-0 flex-col gap-1 rounded-lg border p-4 text-sm"
    >
      <p
        id="community-ban-title"
        className="font-medium [overflow-wrap:anywhere]"
      >
        {t("bannedHere", { nickname: ban.nickname })}
      </p>
      <p>
        {ban.until
          ? t("bannedUntil", { date: date(ban.until) })
          : t("bannedForever")}
      </p>
      <p className="[overflow-wrap:anywhere] whitespace-pre-wrap">
        {t("reason", { reason: ban.reason })}
      </p>
      <p className="text-muted-foreground">{t("bannedHereDetail")}</p>
    </div>
  );
}
