"use client";

import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/action-result";
import type { Direction } from "@/lib/folders/sort";

export function ReorderButtons({
  name,
  isFirst,
  isLast,
  action,
}: {
  name: string;
  isFirst: boolean;
  isLast: boolean;
  action: (direction: Direction) => Promise<ActionResult>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const t = useTranslations("reorder");

  function move(direction: Direction) {
    setError(null);
    startTransition(async () => {
      const result = await action(direction);
      if (!result.ok) setError(result.message);
    });
  }

  return (
    <>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <Button
        variant="ghost"
        size="icon"
        aria-label={t("moveUp", { name })}
        title={t("up")}
        disabled={pending || isFirst}
        onClick={() => move("up")}
      >
        <ArrowUpIcon />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={t("moveDown", { name })}
        title={t("down")}
        disabled={pending || isLast}
        onClick={() => move("down")}
      >
        <ArrowDownIcon />
      </Button>
    </>
  );
}
