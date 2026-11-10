import { AdultBadge } from "@/components/adult";
import type { CoverView } from "@/lib/covers/queries";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: { width: 40, height: 60 },
  md: { width: 120, height: 180 },
  lg: { width: 160, height: 240 },
};

export type CoverSize = keyof typeof SIZES;

export function CoverImage({
  path,
  alt,
  size,
  className,
}: {
  path: string;
  alt: string;
  size: CoverSize;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- our own handler serves the final 600x900 WebP
    <img
      src={path}
      alt={alt}
      {...SIZES[size]}
      loading="lazy"
      className={cn("shrink-0 rounded-sm border object-cover", className)}
    />
  );
}

// Public lists never show an 18+ cover, only the badge in its place; its owner sees it
// marked with the badge (D69).
export function PublicCover({
  cover,
  alt,
  size,
  reveal = false,
}: {
  cover: CoverView;
  alt: string;
  size: CoverSize;
  reveal?: boolean;
}) {
  if (!cover.adult)
    return <CoverImage path={cover.path} alt={alt} size={size} />;
  if (reveal)
    return (
      <span className="relative shrink-0">
        <CoverImage path={cover.path} alt={alt} size={size} className="block" />
        <span className="bg-background absolute right-0.5 bottom-0.5 rounded-sm">
          <AdultBadge />
        </span>
      </span>
    );
  return (
    <span
      style={SIZES[size]}
      className="bg-muted flex shrink-0 items-center justify-center rounded-sm border"
    >
      <AdultBadge />
    </span>
  );
}
