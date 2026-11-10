import { cn } from "@/lib/utils";

export function initials(nickname: string): string {
  const parts = nickname.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : parts[0]?.[0];
  return (letters ?? "?").toUpperCase();
}

// The same colour for a nickname wherever it shows, whatever its case (task 70). Dark enough
// for white initials in both themes.
export function avatarColor(nickname: string): string {
  let hash = 0;
  for (const char of nickname.toLowerCase()) {
    hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  }
  return `hsl(${hash % 360} 55% 38%)`;
}

export function UserAvatar({
  nickname,
  src,
  alt,
  size = 40,
  className,
}: {
  nickname: string;
  src: string | null;
  // Empty next to the nickname, which already names the user.
  alt: string;
  size?: number;
  className?: string;
}) {
  const box = cn("shrink-0 rounded-full", className);
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- our own handler serves the final 256x256 WebP
      <img
        src={src}
        alt={alt}
        width={size}
        height={size}
        loading="lazy"
        className={cn(box, "border object-cover")}
      />
    );
  }
  return (
    <span
      role={alt ? "img" : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        backgroundColor: avatarColor(nickname),
      }}
      className={cn(
        box,
        "flex items-center justify-center font-semibold text-white select-none",
      )}
    >
      {initials(nickname)}
    </span>
  );
}
