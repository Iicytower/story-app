import { Activity } from "@/lib/models/activity";
import { LibraryItem } from "@/lib/models/library-item";
import { ReaderMark } from "@/lib/models/reader-mark";
import { ReadingProgress } from "@/lib/models/reading-progress";

export interface PurgedObjects {
  folderIds: string[];
  storyIds: string[];
}

// Hard deletion of a chapter or folder deletes its social data (D80); soft delete only hides
// it. Each social task adds the collections it owns.
const PURGES: ((objects: PurgedObjects) => Promise<unknown>)[] = [
  ({ folderIds }) => LibraryItem.deleteMany({ folderId: { $in: folderIds } }),
  ({ folderIds }) =>
    ReadingProgress.deleteMany({ folderId: { $in: folderIds } }),
  // The rest of the book's progress stays: only the purged chapters leave it.
  ({ storyIds }) =>
    ReadingProgress.updateMany(
      { readStoryIds: { $in: storyIds } },
      { $pull: { readStoryIds: { $in: storyIds } } },
    ),
  ({ storyIds }) =>
    ReadingProgress.updateMany(
      { lastStoryId: { $in: storyIds } },
      { $unset: { lastStoryId: 1, position: 1 } },
    ),
  ({ folderIds }) => ReaderMark.deleteMany({ folderId: { $in: folderIds } }),
  ({ storyIds }) => ReaderMark.deleteMany({ storyId: { $in: storyIds } }),
  ({ folderIds }) => Activity.deleteMany({ folderId: { $in: folderIds } }),
  // Other chapters of the same publication keep the entry; one left with none goes (task 75).
  async ({ storyIds }) => {
    await Activity.updateMany(
      { storyIds: { $in: storyIds } },
      { $pull: { storyIds: { $in: storyIds } } },
    );
    await Activity.deleteMany({
      type: "chapterPublished",
      storyIds: { $size: 0 },
    });
  },
];

export async function purgeSocialData(objects: PurgedObjects): Promise<void> {
  await Promise.all(PURGES.map((purge) => purge(objects)));
}
