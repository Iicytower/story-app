import { Link } from "@/i18n/navigation";
import { AdultBadge } from "@/components/adult";
import { TagChips } from "@/components/tag-chips";
import type { Snippet } from "@/lib/stories/search";

export interface ChapterItemProps {
  path: string;
  title: string;
  // "in <folder> by <nickname>", translated by the caller.
  byline: string;
  snippet: Snippet;
  tags: string[];
  folderTags: string[];
  adult: boolean;
  date?: { iso: string; text: string };
}

// Shared by the search results and the client-side "Recently published" list.
export function ChapterItem({
  path,
  title,
  byline,
  snippet,
  tags,
  folderTags,
  adult,
  date,
}: ChapterItemProps) {
  return (
    <li>
      <Link
        href={path}
        className="hover:bg-muted/50 flex min-w-0 flex-col gap-1 px-4 py-3 break-words"
      >
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
      </Link>
    </li>
  );
}
