import mongoose from "mongoose";
import { hashPassword } from "@/lib/accounts";
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
    await connection.collection("rateLimits").deleteMany({});
    await connection.collection("users").deleteMany({
      nickname: { $nin: Object.values(USERS).map((user) => user.nickname) },
    });
    await connection.collection("stories").deleteMany({});
    await connection.collection("folders").deleteMany({});
    await connection.collection("settings").deleteMany({});
    await connection.collection("folderVersions").deleteMany({});
    await connection.collection("chapterContents").deleteMany({});
    await connection.collection("covers").deleteMany({});
  });
}

// The limit per account (D74). Requires a counted attempt: the slot id holds a keyed hash.
export function exhaustLoginLimit(): Promise<void> {
  return withE2EDb(async (connection) => {
    await connection
      .collection<{ _id: string }>("rateLimits")
      .updateMany({ _id: /^login-account:/ }, { $set: { count: 1000 } });
  });
}

export function exhaustSearchLimit(): Promise<void> {
  return withE2EDb(async (connection) => {
    await connection
      .collection<{ _id: string }>("rateLimits")
      .updateMany({ _id: /^search:/ }, { $set: { count: 1000 } });
  });
}

// Checks sent to LanguageTool: each takes an attempt of the proofreading limit first.
export function proofreadAttempts(): Promise<number> {
  return withE2EDb(async (connection) => {
    const slots = await connection
      .collection<{ _id: string; count: number }>("rateLimits")
      .find({ _id: /^proofread:/ })
      .toArray();
    return slots.reduce((sum, { count }) => sum + count, 0);
  });
}

export function restorePassword(user: UserName): Promise<void> {
  return withE2EDb(async (connection) => {
    await connection
      .collection("users")
      .updateOne(
        { nickname: USERS[user].nickname },
        { $set: { passwordHash: await hashPassword(USERS[user].password) } },
      );
    // Wrong current passwords of earlier tests must not reach the limit (D75).
    await connection
      .collection<{ _id: string }>("rateLimits")
      .deleteMany({ _id: /^change-password:/ });
  });
}

async function userId(connection: mongoose.Connection, user: UserName) {
  const account = await connection
    .collection("users")
    .findOne({ nickname: USERS[user].nickname });
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
    tags?: string[];
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
      tags: story.tags ?? [],
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
  proofreading?: {
    proposals: {
      at?: number;
      original: string;
      kind?: string;
      message?: string;
      replacements?: string[];
      ruleId?: string;
      choice: number;
    }[];
    selected: number;
  };
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
  published?: boolean;
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

export function seedSettings(
  user: UserName,
  settings: Record<string, unknown>,
): Promise<void> {
  return withE2EDb(async (connection) => {
    await connection
      .collection("settings")
      .insertOne({ userId: await userId(connection, user), ...settings });
  });
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

export function clearSettings(user: UserName): Promise<void> {
  return withE2EDb(async (connection) => {
    await connection
      .collection("settings")
      .deleteOne({ userId: await userId(connection, user) });
  });
}
