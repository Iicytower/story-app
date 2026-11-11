// One mark for folders, chapters and images (D67): set by the owner, by the image filter (task 26)
// or by the admin (task 88). The admin's `true` locks the mark, `false` overrides the others.
export interface AdultMark {
  manual?: boolean;
  auto?: boolean;
  admin?: boolean;
}

// Why the owner cannot remove the mark: the admin's mark, an image the filter rated 18+, or an
// 18+ folder.
export type AdultLock = "admin" | "auto" | "folder" | null;

export interface AdultState {
  adult: boolean;
  lock: AdultLock;
}

export function isAdult(mark: AdultMark | undefined): boolean {
  if (mark?.admin !== undefined) return mark.admin;
  return Boolean(mark?.manual || mark?.auto);
}

function ownLock(mark: AdultMark | undefined): AdultLock {
  if (mark?.admin === true) return "admin";
  return mark?.auto && mark.admin !== false ? "auto" : null;
}

export function folderAdultState(folder: AdultMark | undefined): AdultState {
  return { adult: isAdult(folder), lock: ownLock(folder) };
}

// An 18+ folder makes all its chapters 18+; an 18+ chapter does not mark its folder. The admin's
// `false` on a chapter does not lift its folder's mark (task 88).
export function chapterAdultState(
  chapter: AdultMark | undefined,
  folder: AdultMark | undefined,
): AdultState {
  const lock = ownLock(chapter) ?? (isAdult(folder) ? "folder" : null);
  return { adult: isAdult(chapter) || isAdult(folder), lock };
}
