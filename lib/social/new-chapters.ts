// New chapters of a library book (D80): public ones first published after the book was added
// and not read since. A chapter without publishedAt has never been public.
export function newChapterIds(
  chapters: { id: string; publishedAt?: Date | null }[],
  addedAt: Date,
  readStoryIds: string[],
): string[] {
  const read = new Set(readStoryIds);
  return chapters
    .filter(
      ({ id, publishedAt }) =>
        publishedAt != null &&
        publishedAt.getTime() > addedAt.getTime() &&
        !read.has(id),
    )
    .map(({ id }) => id);
}
