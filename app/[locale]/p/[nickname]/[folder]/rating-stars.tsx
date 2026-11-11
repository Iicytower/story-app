"use client";

import { Star } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  useId,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
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
  label,
  callbackUrl,
}: {
  target: { type: RatingTarget; id: string } | null;
  summary: RatingSummary;
  own: boolean;
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
  const ownNote = useId();

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
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
        <div
          role="group"
          aria-label={label}
          aria-describedby={target && own ? ownNote : undefined}
          className="flex items-center"
        >
          {RATING_VALUES.map((value) => (
            <Button
              key={value}
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t("star", { value })}
              aria-pressed={target ? shown.mine === value : undefined}
              disabled={target !== null && own}
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
        <p className="text-muted-foreground text-sm tabular-nums">
          {t("summary", { count: shown.count, average: average ?? 0 })}
        </p>
      </div>
      {target && own && (
        <p id={ownNote} className="text-muted-foreground text-xs">
          {t("own")}
        </p>
      )}
      {shown.mine !== null && (
        <p className="text-muted-foreground text-xs">
          {t("mine", { value: shown.mine })}
        </p>
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
