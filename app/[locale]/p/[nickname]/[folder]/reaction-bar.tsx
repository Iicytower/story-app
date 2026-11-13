"use client";

import { SmilePlus } from "lucide-react";
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

// Only the reactions given show, each with its count; "Add reaction" picks one of the six (D83).
export function ReactionBar({
  target,
  summary,
  own,
  locked = false,
  label,
  callbackUrl,
}: {
  target: { type: "story" | "comment" | "post"; id: string } | null;
  summary: ReactionSummary;
  own: boolean;
  // Banned in the author's community: the counts stay, the buttons do not work (task 79).
  locked?: boolean;
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
  const [signIn, setSignIn] = useState(false);
  const [picking, setPicking] = useState(false);
  // The dialog has no trigger of its own, so the focus goes back to the button clicked.
  const clicked = useRef<HTMLButtonElement | null>(null);
  const add = useRef<HTMLButtonElement>(null);
  const used = REACTIONS.filter((reaction) => shown.counts.get(reaction));
  const canAdd = !own && !locked;

  function askToSignIn(button: HTMLButtonElement) {
    clicked.current = button;
    setSignIn(true);
  }

  function toggle(reaction: ReactionKey, button: HTMLButtonElement) {
    if (!target) {
      askToSignIn(button);
      return;
    }
    const next = shown.mine === reaction ? null : reaction;
    // Taking off the last one removes its button, so the focus moves to "Add reaction".
    if (next === null && shown.counts.get(reaction) === 1) {
      requestAnimationFrame(() => add.current?.focus());
    }
    setError(null);
    startTransition(async () => {
      setShown(next);
      const result = await react(target.type, target.id, next);
      if (!result.ok) setError(result.message);
    });
  }

  if (used.length === 0 && !canAdd) return null;

  const addButton = (
    <Button
      ref={add}
      type="button"
      variant="ghost"
      size="sm"
      aria-label={t("add")}
      title={t("add")}
      onClick={target ? undefined : (event) => askToSignIn(event.currentTarget)}
      className="text-muted-foreground px-1.5 max-sm:h-9 max-sm:min-w-9"
    >
      <SmilePlus aria-hidden />
    </Button>
  );

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div
        role="group"
        aria-label={label}
        className="flex min-w-0 flex-wrap items-center gap-1"
      >
        {used.map((reaction) => {
          const count = shown.counts.get(reaction)!;
          const chosen = shown.mine === reaction;
          const nicknames =
            summary.groups.find((group) => group.reaction === reaction) ?? null;
          return (
            <div
              key={reaction}
              className={cn(
                "flex items-center rounded-md border",
                chosen && "bg-primary/10 border-primary/40",
              )}
            >
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={t("react", {
                  reaction: t(`names.${reaction}`),
                  count,
                })}
                aria-pressed={target ? chosen : undefined}
                disabled={target !== null && (own || locked || pending)}
                onClick={(event) => toggle(reaction, event.currentTarget)}
                className="rounded-r-none px-1.5 max-sm:h-9 max-sm:min-w-9"
              >
                <span aria-hidden>{REACTION_EMOJI[reaction]}</span>
              </Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={t("whoFor", {
                      reaction: t(`names.${reaction}`),
                    })}
                    className={cn(
                      "rounded-l-none pr-2 pl-1 tabular-nums max-sm:h-9 max-sm:min-w-9",
                      chosen && "font-semibold",
                    )}
                  >
                    {count}
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  aria-label={t("who")}
                  collisionPadding={16}
                  className="max-h-80 w-80 max-w-[calc(100vw-2rem)] overflow-y-auto text-sm [overflow-wrap:anywhere]"
                >
                  <p className="mb-2 flex gap-2 font-medium">
                    <span aria-hidden>{REACTION_EMOJI[reaction]}</span>
                    {t(`names.${reaction}`)}
                  </p>
                  {nicknames && (
                    <ul aria-label={t("who")} className="flex flex-col gap-1">
                      {nicknames.nicknames.map((nickname) => (
                        <li key={nickname} className="min-w-0">
                          <UserLink nickname={nickname} />
                        </li>
                      ))}
                      {nicknames.count > nicknames.nicknames.length && (
                        <li className="text-muted-foreground">
                          {t("more", {
                            count: nicknames.count - nicknames.nicknames.length,
                          })}
                        </li>
                      )}
                    </ul>
                  )}
                </PopoverContent>
              </Popover>
            </div>
          );
        })}
        {canAdd &&
          (target ? (
            <Popover open={picking} onOpenChange={setPicking}>
              <PopoverTrigger asChild>{addButton}</PopoverTrigger>
              <PopoverContent
                aria-label={t("pick")}
                collisionPadding={16}
                className="w-auto p-1"
              >
                <div
                  role="group"
                  aria-label={t("pick")}
                  className="flex gap-0.5"
                >
                  {REACTIONS.map((reaction) => (
                    <Button
                      key={reaction}
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={t(`names.${reaction}`)}
                      aria-pressed={shown.mine === reaction}
                      title={t(`names.${reaction}`)}
                      disabled={pending}
                      onClick={(event) => {
                        setPicking(false);
                        toggle(reaction, event.currentTarget);
                      }}
                      className={cn(
                        "px-1.5 text-base max-sm:size-10",
                        shown.mine === reaction &&
                          "bg-primary/10 ring-primary/40 ring-1",
                      )}
                    >
                      <span aria-hidden>{REACTION_EMOJI[reaction]}</span>
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          ) : (
            addButton
          ))}
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
