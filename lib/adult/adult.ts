// One mark for folders, chapters and images (D67): set by the owner or by the image filter (task 26).
export interface AdultMark {
  manual?: boolean;
  auto?: boolean;
}

// Why the owner cannot remove the mark: an image the filter rated 18+, or an 18+ folder.
export type AdultLock = "auto" | "folder" | null;

export interface AdultState {
  adult: boolean;
  lock: AdultLock;
}

export function isAdult(mark: AdultMark | undefined): boolean {
  return Boolean(mark?.manual || mark?.auto);
}

export function folderAdultState(folder: AdultMark | undefined): AdultState {
  return { adult: isAdult(folder), lock: folder?.auto ? "auto" : null };
}

// An 18+ folder makes all its chapters 18+; an 18+ chapter does not mark its folder.
export function chapterAdultState(
  chapter: AdultMark | undefined,
  folder: AdultMark | undefined,
): AdultState {
  const lock: AdultLock = chapter?.auto
    ? "auto"
    : isAdult(folder)
      ? "folder"
      : null;
  return { adult: isAdult(chapter) || isAdult(folder), lock };
}
