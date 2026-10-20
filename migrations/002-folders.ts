import type { mongo } from "mongoose";

export const id = "002-folders";
export const collections = ["stories"];
// v1.0 keeps serving traffic during the build and may create stories without a folder.
export const repeatable = true;

const FOLDER_NAME = "Unsorted";

type StoryDoc = {
  _id: mongo.ObjectId;
  userId: mongo.ObjectId;
  title: string;
  updatedAt: Date;
  deletedAt: Date | null;
};

export async function up(db: mongo.Db): Promise<void> {
  const stories = db.collection<StoryDoc>("stories");
  const folders = db.collection("folders");
  const orphans = await stories
    .find({ folderId: { $exists: false } })
    .sort({ _id: 1 })
    .toArray();

  const byUser = new Map<string, StoryDoc[]>();
  for (const story of orphans) {
    const key = story.userId.toString();
    byUser.set(key, [...(byUser.get(key) ?? []), story]);
  }

  for (const userStories of byUser.values()) {
    const now = new Date();
    const latest = userStories
      .filter((story) => story.deletedAt === null)
      .map((story) => story.updatedAt)
      .sort((a, b) => b.getTime() - a.getTime())[0];
    // The native driver applies no schema defaults, and without deletedAt: null
    // the folder would fall outside the partial unique index.
    const base = {
      notes: "",
      notesUpdatedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    const folder = await folders.findOneAndUpdate(
      { userId: userStories[0].userId, name: FOLDER_NAME, deletedAt: null },
      latest
        ? { $setOnInsert: base, $max: { lastActivityAt: latest } }
        : { $setOnInsert: { ...base, lastActivityAt: now } },
      { upsert: true, returnDocument: "after" },
    );
    for (const story of userStories) {
      await assignToFolder(stories, story, folder!._id);
    }
  }
}

// v1.0 can create a title that already exists in the folder once the old
// { userId, title } index is gone, so a colliding story gets a numbered suffix.
async function assignToFolder(
  stories: mongo.Collection<StoryDoc>,
  story: StoryDoc,
  folderId: mongo.ObjectId,
): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    const title = attempt === 1 ? story.title : `${story.title} (${attempt})`;
    try {
      await stories.updateOne(
        { _id: story._id },
        { $set: { folderId, title } },
      );
      return;
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
    }
  }
}
