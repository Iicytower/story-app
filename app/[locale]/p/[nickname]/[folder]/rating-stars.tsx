"use client";

import { Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { useOptimistic, useRef, useState, useTransition } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  RATING_VALUES,
  ratingAverage,
  type RatingSummary,
  type RatingTarget,
} from "@/lib/social/ratings";
import { AuthDialog } from "../../../auth/auth-dialog";
import { rate, removeRating } from "./rating-actions";

// The reader's own value moves the count and sum before the server confirms it.
function choose(summary: RatingSummary, next: number | null): RatingSummary {
  const count = summary.count - (summary.mine ? 1 : 0) + (next ? 1 : 0);
  const sum = summary.sum - (summary.mine ?? 0) + (next ?? 0);
  return { count, sum, mine: next };
}

export function RatingStars({
  target,
  summary,
  own,
  locked = false,
  label,
  callbackUrl,
}: {
  target: { type: RatingTarget; id: string } | null;
  summary: RatingSummary;
  own: boolean;
  // Banned in the author's community: the average stays, the stars do not work (task 79).
  locked?: boolean;
  label: string;
  callbackUrl: string;
}) {
  const t = useTranslations("ratings");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [shown, setShown] = useOptimistic(summary, (_, next: number | null) =>
    choose(summary, next),
  );
  const [signIn, setSignIn] = useState(false);
  // The dialog has no trigger of its own, so the focus goes back to the star clicked.
  const clicked = useRef<HTMLButtonElement | null>(null);

  function pick(value: number, button: HTMLButtonElement) {
    if (!target) {
      clicked.current = button;
      setSignIn(true);
      return;
    }
    // aria-disabled rather than disabled, so the focus stays on the star while saving.
    if (pending) return;
    // The chosen star again takes the rating off.
    const next = shown.mine === value ? null : value;
    setError(null);
    startTransition(async () => {
      setShown(next);
      const result =
        next === null
          ? await removeRating(target.type, target.id)
          : await rate(target.type, target.id, next);
      if (!result.ok) setError(result.message);
    });
  }

  const average = ratingAverage(shown);
  // The average is a number, so the stars mean only the reader's own rating (D83).
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <p className="text-sm tabular-nums">
        {t("summary", { count: shown.count, average: average ?? 0 })}
      </p>
      {target && own ? (
        <p className="text-muted-foreground text-xs">{t("own")}</p>
      ) : (
        <div className="flex min-w-0 flex-wrap items-center gap-x-2">
          <span className="text-muted-foreground text-sm">{t("yours")}</span>
          <div role="group" aria-label={label} className="flex items-center">
            {RATING_VALUES.map((value) => (
              <Button
                key={value}
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t("star", { value })}
                aria-pressed={target ? shown.mine === value : undefined}
                disabled={target !== null && locked}
                aria-disabled={target !== null && pending ? true : undefined}
                onClick={(event) => pick(value, event.currentTarget)}
              >
                <Star
                  aria-hidden
                  className={cn(
                    "size-5",
                    shown.mine !== null && value <= shown.mine
                      ? "fill-amber-400 text-amber-500 dark:fill-amber-300 dark:text-amber-300"
                      : "text-muted-foreground",
                  )}
                />
              </Button>
            ))}
          </div>
        </div>
      )}
      {!target && (
        <AuthDialog
          callbackUrl={callbackUrl}
          trigger={null}
          open={signIn}
          onOpenChange={(open) => {
            setSignIn(open);
            if (!open) requestAnimationFrame(() => clicked.current?.focus());
          }}
        />
      )}
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
