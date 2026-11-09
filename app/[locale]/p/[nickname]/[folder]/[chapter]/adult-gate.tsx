"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Link, useRouter } from "@/i18n/navigation";
import { ADULT_COOKIE, ADULT_COOKIE_MAX_AGE } from "@/lib/adult/gate";

export function AdultGate({ backPath }: { backPath: string }) {
  const t = useTranslations("adult");
  const router = useRouter();

  function confirm() {
    document.cookie = `${ADULT_COOKIE}=1; path=/; max-age=${ADULT_COOKIE_MAX_AGE}; samesite=lax`;
    router.refresh();
  }

  return (
    <section
      aria-labelledby="adult-gate-title"
      className="flex flex-col items-start gap-4 rounded-lg border p-6"
    >
      <h2 id="adult-gate-title" className="text-xl font-semibold">
        {t("gateTitle")}
      </h2>
      <p className="text-muted-foreground">{t("gateText")}</p>
      <div className="flex gap-2">
        <Button onClick={confirm}>{t("gateConfirm")}</Button>
        <Button variant="outline" asChild>
          <Link href={backPath}>{t("gateBack")}</Link>
        </Button>
      </div>
    </section>
  );
}
