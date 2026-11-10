import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export const profilePath = (nickname: string) => `/p/${nickname}`;

export function UserLink({
  nickname,
  className,
}: {
  nickname: string;
  className?: string;
}) {
  return (
    <Link
      href={profilePath(nickname)}
      className={cn("font-medium hover:underline", className)}
    >
      {nickname}
    </Link>
  );
}
