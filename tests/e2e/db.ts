import mongoose from "mongoose";
import { E2E_MONGODB_URI, USERS, type UserName } from "./env";

export async function withE2EDb<T>(
  fn: (connection: mongoose.Connection) => Promise<T>,
): Promise<T> {
  const connection = await mongoose
    .createConnection(E2E_MONGODB_URI)
    .asPromise();
  try {
    return await fn(connection);
  } finally {
    await connection.close();
  }
}

export function clearStories(): Promise<void> {
  return withE2EDb(async (connection) => {
    await connection.collection("stories").deleteMany({});
    await connection.collection("folders").deleteMany({});
    await connection.collection("settings").deleteMany({});
    await connection.collection("folderVersions").deleteMany({});
    await connection.collection("chapterContents").deleteMany({});
  });
}

async function userId(connection: mongoose.Connection, user: UserName) {
  const account = await connection
    .collection("users")
    .findOne({ email: USERS[user].email });
  if (!account) throw new Error(`User ${user} is not seeded`);
  return account._id;
}

// Finds or creates an active folder; every field is set because the native driver applies no schema defaults.
async function ensureFolder(
  connection: mongoose.Connection,
  user: UserName,
  name: string,
  lastActivityAt = new Date(),
) {
  const owner = await userId(connection, user);
  const now = new Date();
  const folders = connection.collection("folders");
  const position = await folders.countDocuments({ userId: owner });
  const folder = await folders.findOneAndUpdate(
    { userId: owner, name, deletedAt: null },
    {
      $setOnInsert: {
        notes: "",
        notesUpdatedAt: now,
        lastActivityAt,
        position,
        chapterSort: "created",
        manualChapterOrder: false,
        createdAt: now,
        updatedAt: now,
      },
    },
    { upsert: true, returnDocument: "after" },
  );
  return folder!._id;
}

export function seedFolder(
  user: UserName,
  name: string,
  lastActivityAt?: Date,
): Promise<string> {
  return withE2EDb(async (connection) =>
    (await ensureFolder(connection, user, name, lastActivityAt)).toString(),
  );
}

export function seedStory(
  user: UserName,
  story: {
    title: string;
    folder?: string;
    content?: string;
    notes?: string;
    createdAt?: Date;
    updatedAt?: Date;
    deletedAt?: Date;
  },
): Promise<string> {
  return withE2EDb(async (connection) => {
    const folderId = await ensureFolder(
      connection,
      user,
      story.folder ?? "Unsorted",
    );
    const now = new Date();
    const stories = connection.collection("stories");
    const { insertedId } = await stories.insertOne({
      userId: await userId(connection, user),
      folderId,
      position: await stories.countDocuments({ folderId }),
      title: story.title,
      content: story.content ?? "",
      notes: story.notes ?? "",
      deletedAt: story.deletedAt ?? null,
      createdAt: story.createdAt ?? now,
      updatedAt: story.updatedAt ?? now,
    });
    return insertedId.toString();
  });
}

type StoryDoc = {
  title: string;
  content: string;
  notes: string;
  updatedAt: Date;
  deletedAt: Date | null;
};

export function findStory(title: string): Promise<StoryDoc | null> {
  return withE2EDb((connection) =>
    connection.collection<StoryDoc>("stories").findOne({ title }),
  );
}

export function findStoryById(id: string): Promise<StoryDoc | null> {
  return withE2EDb((connection) =>
    connection
      .collection<StoryDoc>("stories")
      .findOne({ _id: new mongoose.Types.ObjectId(id) }),
  );
}

export function updateStoryById(
  id: string,
  fields: Partial<StoryDoc>,
): Promise<void> {
  return withE2EDb(async (connection) => {
    await connection
      .collection("stories")
      .updateOne({ _id: new mongoose.Types.ObjectId(id) }, { $set: fields });
  });
}

type FolderDoc = {
  _id: mongoose.Types.ObjectId;
  name: string;
  notes: string;
  deletedAt: Date | null;
};

export function findFolder(name: string): Promise<FolderDoc | null> {
  return withE2EDb((connection) =>
    connection.collection<FolderDoc>("folders").findOne({ name }),
  );
}

export function findStoryFolder(title: string): Promise<string | undefined> {
  return withE2EDb(async (connection) => {
    const story = await connection.collection("stories").findOne({ title });
    return story?.folderId?.toString();
  });
}

export function findSettings(
  user: UserName,
): Promise<Record<string, Record<string, unknown> | undefined> | null> {
  return withE2EDb(async (connection) =>
    connection
      .collection("settings")
      .findOne({ userId: await userId(connection, user) }),
  );
}

export function findFolderVersion(
  number: number,
): Promise<{ name: string; folderNotes: string } | null> {
  return withE2EDb((connection) =>
    connection
      .collection<{ name: string; folderNotes: string }>("folderVersions")
      .findOne({ number }),
  );
}
