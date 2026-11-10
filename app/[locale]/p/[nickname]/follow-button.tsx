"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { profilePath } from "@/components/user-link";
import { AuthDialog } from "../../auth/auth-dialog";
import { follow, unfollow } from "./actions";

export function FollowButton({
  nickname,
  followed,
}: {
  nickname: string;
  // null: a guest, who signs in first.
  followed: boolean | null;
}) {
  const t = useTranslations("profile");
  const tErrors = useTranslations("errors");
  const locale = useLocale();
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (followed === null) {
    return (
      <AuthDialog
        callbackUrl={`/${locale}${profilePath(nickname)}`}
        trigger={<Button>{t("follow")}</Button>}
      />
    );
  }

  function toggle() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await (followed ? unfollow : follow)(nickname);
        if (!result.ok) setError(result.message);
      } catch {
        setError(tErrors("offline"));
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        variant={followed ? "outline" : "default"}
        aria-pressed={followed}
        disabled={busy}
        onClick={toggle}
      >
        {followed ? (
          <>
            <span className="group-hover/button:hidden group-focus-visible/button:hidden">
              {t("following")}
            </span>
            <span className="hidden group-hover/button:inline group-focus-visible/button:inline">
              {t("unfollow")}
            </span>
          </>
        ) : (
          t("follow")
        )}
      </Button>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
