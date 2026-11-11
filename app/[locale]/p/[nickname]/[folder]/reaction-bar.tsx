"use client";

import { useTranslations } from "next-intl";
import { useOptimistic, useRef, useState, useTransition } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { UserLink } from "@/components/user-link";
import {
  REACTION_EMOJI,
  REACTIONS,
  type ReactionKey,
  type ReactionSummary,
} from "@/lib/social/reactions";
import { AuthDialog } from "../../../auth/auth-dialog";
import { react } from "./reaction-actions";

// The reader's own reaction moves from one count to another before the server confirms it.
function choose(summary: ReactionSummary, next: ReactionKey | null) {
  const counts = new Map(
    summary.groups.map(({ reaction, count }) => [reaction, count]),
  );
  if (summary.mine) counts.set(summary.mine, counts.get(summary.mine)! - 1);
  if (next) counts.set(next, (counts.get(next) ?? 0) + 1);
  return { counts, mine: next };
}

export function ReactionBar({
  target,
  summary,
  own,
  label,
  callbackUrl,
}: {
  target: { type: "story" | "comment"; id: string } | null;
  summary: ReactionSummary;
  own: boolean;
  label: string;
  callbackUrl: string;
}) {
  const t = useTranslations("reactions");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [shown, setShown] = useOptimistic(
    choose(summary, summary.mine),
    (_, next: ReactionKey | null) => choose(summary, next),
  );
  const total = [...shown.counts.values()].reduce(
    (sum, count) => sum + count,
    0,
  );
  const [signIn, setSignIn] = useState(false);
  // The dialog has no trigger of its own, so the focus goes back to the reaction clicked.
  const clicked = useRef<HTMLButtonElement | null>(null);

  function toggle(reaction: ReactionKey, button: HTMLButtonElement) {
    if (!target) {
      clicked.current = button;
      setSignIn(true);
      return;
    }
    const next = shown.mine === reaction ? null : reaction;
    setError(null);
    startTransition(async () => {
      setShown(next);
      const result = await react(target.type, target.id, next);
      if (!result.ok) setError(result.message);
    });
  }

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div
        role="group"
        aria-label={label}
        className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5"
      >
        <div className="flex items-center gap-0.5">
          {REACTIONS.map((reaction) => {
            const count = shown.counts.get(reaction) ?? 0;
            const chosen = shown.mine === reaction;
            return (
              <Button
                key={reaction}
                type="button"
                variant="ghost"
                size="sm"
                aria-label={t("react", {
                  reaction: t(`names.${reaction}`),
                  count,
                })}
                aria-pressed={target ? chosen : undefined}
                disabled={target !== null && (own || pending)}
                onClick={(event) => toggle(reaction, event.currentTarget)}
                className={cn(
                  "px-1.5 tabular-nums",
                  chosen &&
                    "bg-primary/10 ring-primary/40 font-semibold ring-1",
                )}
              >
                <span aria-hidden>{REACTION_EMOJI[reaction]}</span>
                {count > 0 && <span aria-hidden>{count}</span>}
              </Button>
            );
          })}
        </div>
        {total > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="link"
                size="sm"
                aria-label={`${t("who")}: ${t("total", { count: total })}`}
                className="text-muted-foreground"
              >
                {t("total", { count: total })}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              aria-label={t("who")}
              collisionPadding={16}
              className="max-h-80 w-80 max-w-[calc(100vw-2rem)] overflow-y-auto"
            >
              <ul aria-label={t("who")} className="flex flex-col gap-2 text-sm">
                {summary.groups.map(({ reaction, count, nicknames }) => (
                  <li
                    key={reaction}
                    className="flex min-w-0 gap-2 [overflow-wrap:anywhere]"
                  >
                    <span aria-hidden>{REACTION_EMOJI[reaction]}</span>
                    <span className="sr-only">{t(`names.${reaction}`)}:</span>
                    <span className="min-w-0">
                      {nicknames.map((nickname, index) => (
                        <span key={nickname}>
                          {index > 0 && ", "}
                          <UserLink nickname={nickname} />
                        </span>
                      ))}
                      {count > nicknames.length && (
                        <span className="text-muted-foreground">
                          {nicknames.length > 0 && " "}
                          {t("more", { count: count - nicknames.length })}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </PopoverContent>
          </Popover>
        )}
      </div>
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
