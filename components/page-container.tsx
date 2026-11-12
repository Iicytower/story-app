import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

// Two content widths (D83): narrow for lists, reading and forms, wide for tables and a book.
const WIDTHS = {
  narrow: "max-w-3xl",
  wide: "max-w-5xl",
} as const;

export function PageContainer({
  width,
  as: Tag = "div",
  className,
  ...props
}: ComponentProps<"div"> & {
  width: keyof typeof WIDTHS;
  as?: "div" | "article";
}) {
  return (
    <Tag
      className={cn(
        "mx-auto flex w-full min-w-0 flex-col gap-6 px-4 py-8 sm:px-6",
        WIDTHS[width],
        className,
      )}
      {...props}
    />
  );
}
