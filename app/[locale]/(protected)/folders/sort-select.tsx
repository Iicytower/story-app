"use client";

import { useOptimistic, useState, useTransition } from "react";
import type { ActionResult } from "@/lib/action-result";

export function SortSelect({
  label,
  value,
  options,
  action,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  action: (mode: string) => Promise<ActionResult>;
}) {
  const [optimistic, setOptimistic] = useOptimistic(value);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleChange(mode: string) {
    setError(null);
    startTransition(async () => {
      setOptimistic(mode);
      const result = await action(mode);
      if (!result.ok) setError(result.message);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <select
        aria-label={label}
        value={optimistic}
        disabled={pending}
        onChange={(event) => handleChange(event.target.value)}
        className="border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 h-8 rounded-lg border bg-transparent px-2 text-sm outline-none focus-visible:ring-3"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
