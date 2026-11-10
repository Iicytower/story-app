import { connectDB } from "@/lib/db";
import { Folder } from "@/lib/models/folder";
import { Story } from "@/lib/models/story";
import { isAuthorVisibleTo } from "@/lib/social/permissions";

// D38 for a signed-in reader's writes, the same as the library (task 72): hidden authors' books
// are not found. A chapter's comments are off when its book's are.
export async function findVisibleStory(viewerId: string, storyId: string) {
  await connectDB();
  const story = await Story.findOne({
    _id: storyId,
    publication: "public",
    deletedAt: null,
  })
    .select({ folderId: 1, userId: 1, commentsDisabled: 1 })
    .lean();
  if (!story) return null;
  const [folder, author] = await Promise.all([
    Folder.findOne({
      _id: story.folderId,
      userId: story.userId,
      published: true,
      deletedAt: null,
    })
      .select({ commentsDisabled: 1 })
      .lean(),
    isAuthorVisibleTo(viewerId, story.userId),
  ]);
  if (!folder || !author) return null;
  return {
    _id: story._id,
    folderId: story.folderId,
    userId: story.userId,
    commentsDisabled: Boolean(
      story.commentsDisabled || folder.commentsDisabled,
    ),
  };
}

// A published book is public only with a public chapter in it (D38).
export async function findVisibleFolder(viewerId: string, folderId: string) {
  await connectDB();
  const folder = await Folder.findOne({
    _id: folderId,
    published: true,
    deletedAt: null,
  })
    .select({ userId: 1, commentsDisabled: 1 })
    .lean();
  if (!folder) return null;
  const [chapter, author] = await Promise.all([
    Story.exists({
      userId: folder.userId,
      folderId: folder._id,
      publication: "public",
      deletedAt: null,
    }),
    isAuthorVisibleTo(viewerId, folder.userId),
  ]);
  if (!chapter || !author) return null;
  return {
    _id: folder._id,
    userId: folder.userId,
    commentsDisabled: Boolean(folder.commentsDisabled),
  };
}
