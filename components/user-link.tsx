import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export const profilePath = (nickname: string) => `/p/${nickname}`;

export function UserLink({
  nickname,
  className,
  children,
}: {
  nickname: string;
  className?: string;
  // The text as written, e.g. a mention; the nickname by default.
  children?: ReactNode;
}) {
  return (
    <Link
      href={profilePath(nickname)}
      className={cn("font-medium hover:underline", className)}
    >
      {children ?? nickname}
    </Link>
  );
}
