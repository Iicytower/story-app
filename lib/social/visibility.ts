import { connectDB } from "@/lib/db";
import { Comment } from "@/lib/models/comment";
import { Folder } from "@/lib/models/folder";
import { Story } from "@/lib/models/story";
import { User } from "@/lib/models/user";
import { hiddenUserIdsFor, isAuthorVisibleTo } from "@/lib/social/permissions";

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

// A comment the reader sees as one (task 76): not deleted or hidden, comments on, its place
// public, and neither it nor its thread written by an account hidden from the reader.
export async function findVisibleComment(viewerId: string, commentId: string) {
  await connectDB();
  const comment = await Comment.findOne({
    _id: commentId,
    deletedAt: null,
    hidden: { $exists: false },
  })
    .select({ userId: 1, parentId: 1, folderId: 1, storyId: 1 })
    .lean();
  if (!comment) return null;
  const [place, root, hidden, named] = await Promise.all([
    comment.storyId
      ? findVisibleStory(viewerId, comment.storyId.toString())
      : findVisibleFolder(viewerId, comment.folderId.toString()),
    comment.parentId
      ? Comment.findById(comment.parentId).select({ userId: 1 }).lean()
      : comment,
    hiddenUserIdsFor(viewerId),
    User.exists({ _id: comment.userId, nickname: { $type: "string" } }),
  ]);
  if (!place || place.commentsDisabled || !root || !named) return null;
  if (
    hidden.some((id) => id.equals(comment.userId) || id.equals(root.userId))
  ) {
    return null;
  }
  return {
    _id: comment._id,
    writerId: comment.userId,
    authorId: place.userId,
    folderId: comment.folderId,
    storyId: comment.storyId,
  };
}

// Whether the viewer wrote the chapter or book: nobody reports their own (task 80).
export async function ownsPlace(
  viewerId: string | null,
  target: { type: "story" | "folder"; id: string },
): Promise<boolean> {
  if (!viewerId) return false;
  await connectDB();
  const owned =
    target.type === "story"
      ? await Story.exists({
          _id: target.id,
          userId: viewerId,
          deletedAt: null,
        })
      : await Folder.exists({
          _id: target.id,
          userId: viewerId,
          deletedAt: null,
        });
  return owned !== null;
}
