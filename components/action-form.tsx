"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import type { ActionResult } from "@/lib/action-result";

export const SELECT =
  "border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 h-8 rounded-lg border bg-transparent px-2 text-base outline-none focus-visible:ring-3 md:text-sm";

// Runs an action, keeps its error next to the form and reports success.
export function useAction() {
  const tErrors = useTranslations("errors");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  function run(action: () => Promise<ActionResult>, onDone?: () => void) {
    setError(null);
    startTransition(async () => {
      let result: ActionResult;
      try {
        result = await action();
      } catch {
        setError(tErrors("offline"));
        return;
      }
      if (!result.ok) {
        setError(result.message);
        return;
      }
      onDone?.();
    });
  }
  return { error, pending, run, reset: () => setError(null) };
}

export function ErrorText({
  id,
  error,
}: {
  id?: string;
  error: string | null;
}) {
  return error ? (
    <p id={id} role="alert" className="text-destructive text-sm">
      {error}
    </p>
  ) : null;
}
