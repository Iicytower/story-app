import { Link } from "@/i18n/navigation";
import { AdultBadge } from "@/components/adult";
import { PublicCover } from "@/components/cover";
import { TagChips } from "@/components/tag-chips";
import type { CoverView } from "@/lib/covers/queries";
import type { Snippet } from "@/lib/stories/search";

export interface ChapterItemProps {
  path: string;
  title: string;
  // "in <folder> by <nickname>", translated by the caller.
  byline: string;
  // Search results only; one line, cut off.
  folderDescription?: string;
  snippet: Snippet;
  tags: string[];
  folderTags: string[];
  adult: boolean;
  cover: CoverView | null;
  // The cover's alt text, translated by the caller.
  coverAlt: string;
  date?: { iso: string; text: string };
}

// Shared by the search results and the client-side "Recently published" list.
export function ChapterItem({
  path,
  title,
  byline,
  folderDescription,
  snippet,
  tags,
  folderTags,
  adult,
  cover,
  coverAlt,
  date,
}: ChapterItemProps) {
  return (
    <li>
      <Link
        href={path}
        className="hover:bg-muted/50 flex min-w-0 gap-3 px-4 py-3 break-words"
      >
        {cover && <PublicCover cover={cover} alt={coverAlt} size="sm" />}
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="min-w-0 font-medium">{title}</span>
            {adult && <AdultBadge />}
            <span className="text-muted-foreground min-w-0 text-xs">
              {byline}
            </span>
            {date && (
              <time
                dateTime={date.iso}
                className="text-muted-foreground ml-auto text-xs whitespace-nowrap"
              >
                {date.text}
              </time>
            )}
          </span>
          {folderDescription && (
            <span
              title={folderDescription}
              className="text-muted-foreground truncate text-xs italic"
            >
              {folderDescription}
            </span>
          )}
          <span className="text-muted-foreground line-clamp-2 text-sm">
            {snippet.before}
            {snippet.match && (
              <mark className="text-foreground bg-highlight rounded-sm">
                {snippet.match}
              </mark>
            )}
            {snippet.after}
          </span>
          <TagChips tags={tags} folderTags={folderTags} />
        </span>
      </Link>
    </li>
  );
}
