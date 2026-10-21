"use client";

import type { VersionListItem } from "@/lib/versions/queries";
import { FolderNotesField, useFolderNotes } from "./folder-notes";
import { FolderVersions } from "./versions/folder-versions";

// Owns the folder notes, so saving a version can save them first.
export function FolderSidebar({
  folderId,
  initialNotes,
  initialNotesUpdatedAt,
  versions,
}: {
  folderId: string;
  initialNotes: string;
  initialNotesUpdatedAt: string;
  versions: VersionListItem[];
}) {
  const notes = useFolderNotes(folderId, initialNotes, initialNotesUpdatedAt);
  return (
    <div className="flex flex-col gap-6">
      <FolderNotesField state={notes} className="h-96 rounded-lg border" />
      <FolderVersions
        folderId={folderId}
        versions={versions}
        saveNotes={notes.flush}
      />
    </div>
  );
}
