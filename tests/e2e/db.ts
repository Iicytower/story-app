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
    await connection.collection("avatars").deleteMany({});
    await connection.collection("profiles").deleteMany({});
    await connection.collection("follows").deleteMany({});
    await connection.collection("shelves").deleteMany({});
    await connection.collection("libraryItems").deleteMany({});
    await connection.collection("readingProgress").deleteMany({});
    await connection.collection("readerMarks").deleteMany({});
    await connection.collection("activity").deleteMany({});
    await connection.collection("comments").deleteMany({});
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

// A published folder with chapters that are public or hidden (D38).
export function seedPublished(
  user: UserName,
  folder: string,
  chapters: {
    title: string;
    publication: "public" | "hidden";
    content?: string;
    createdAt?: Date;
  }[],
): Promise<void> {
  return withE2EDb(async (connection) => {
    const folderId = await ensureFolder(connection, user, folder);
    await connection
      .collection("folders")
      .updateOne({ _id: folderId }, { $set: { published: true } });
    for (const { title, publication, content, createdAt } of chapters) {
      const id = await seedStory(user, { title, folder, content, createdAt });
      // A chapter that has never been public has no publication date (D54).
      await connection.collection("stories").updateOne(
        { _id: new mongoose.Types.ObjectId(id) },
        {
          $set: {
            publication,
            ...(publication === "public" && { publishedAt: new Date() }),
          },
        },
      );
    }
  });
}

export function seedProfile(user: UserName, bio: string): Promise<void> {
  return withE2EDb(async (connection) => {
    const now = new Date();
    await connection.collection("profiles").updateOne(
      { userId: await userId(connection, user) },
      {
        $set: { bio, updatedAt: now },
        $setOnInsert: { libraryPublic: true, createdAt: now },
      },
      { upsert: true },
    );
  });
}

export function seedFollow(
  follower: UserName,
  followee: UserName,
): Promise<void> {
  return withE2EDb(async (connection) => {
    await connection.collection("follows").insertOne({
      followerId: await userId(connection, follower),
      followeeId: await userId(connection, followee),
      createdAt: new Date(),
    });
  });
}

export function countFollows(): Promise<number> {
  return withE2EDb((connection) =>
    connection.collection("follows").countDocuments(),
  );
}

export function findLibraryItems(
  user: UserName,
): Promise<{ shelves: string[] }[]> {
  return withE2EDb(async (connection) => {
    const userIdValue = await userId(connection, user);
    const items = await connection
      .collection<{ shelfIds: mongoose.Types.ObjectId[] }>("libraryItems")
      .find({ userId: userIdValue })
      .toArray();
    const shelves = await connection
      .collection<{ name: string }>("shelves")
      .find({ userId: userIdValue })
      .toArray();
    const names = new Map(shelves.map(({ _id, name }) => [String(_id), name]));
    return items.map(({ shelfIds }) => ({
      shelves: shelfIds.map((id) => names.get(String(id)) ?? "").sort(),
    }));
  });
}

export function seedLibraryItem(
  reader: UserName,
  author: UserName,
  folder: string,
): Promise<void> {
  return withE2EDb(async (connection) => {
    await connection.collection("libraryItems").insertOne({
      userId: await userId(connection, reader),
      folderId: await ensureFolder(connection, author, folder),
      shelfIds: [],
      addedAt: new Date(),
    });
  });
}

export function findReadingProgress(
  user: UserName,
): Promise<{ position?: number; read: number } | null> {
  return withE2EDb(async (connection) => {
    const entry = await connection
      .collection<{ position?: number; readStoryIds: unknown[] }>(
        "readingProgress",
      )
      .findOne({ userId: await userId(connection, user) });
    return entry
      ? { position: entry.position, read: entry.readStoryIds.length }
      : null;
  });
}

export function seedReadingProgress(
  reader: UserName,
  author: UserName,
  folder: string,
  chapter: string,
): Promise<void> {
  return withE2EDb(async (connection) => {
    const folderId = await ensureFolder(connection, author, folder);
    const story = await connection
      .collection("stories")
      .findOne({ folderId, title: chapter, deletedAt: null });
    await connection.collection("readingProgress").insertOne({
      userId: await userId(connection, reader),
      folderId,
      lastStoryId: story!._id,
      position: 0.5,
      readStoryIds: [],
      updatedAt: new Date(),
    });
  });
}

export function clearReadingProgress(reader: UserName): Promise<void> {
  return withE2EDb(async (connection) => {
    await connection
      .collection("readingProgress")
      .deleteMany({ userId: await userId(connection, reader) });
  });
}

export function findReaderMarks(user: UserName): Promise<
  {
    kind: string;
    position: number;
    name?: string;
    quote?: string;
    text?: string;
  }[]
> {
  return withE2EDb(async (connection) =>
    connection
      .collection<{
        kind: string;
        position: number;
        name?: string;
        quote?: string;
        text?: string;
      }>("readerMarks")
      .find(
        { userId: await userId(connection, user) },
        {
          projection: {
            _id: 0,
            kind: 1,
            position: 1,
            name: 1,
            quote: 1,
            text: 1,
          },
        },
      )
      .toArray(),
  );
}

// The author edits a chapter, e.g. the passage of a reader's note.
export function setStoryContent(
  author: UserName,
  folder: string,
  title: string,
  content: string,
): Promise<void> {
  return withE2EDb(async (connection) => {
    const owner = await userId(connection, author);
    const folderDoc = await connection
      .collection("folders")
      .findOne({ userId: owner, name: folder, deletedAt: null });
    const { matchedCount } = await connection
      .collection("stories")
      .updateOne(
        { userId: owner, folderId: folderDoc?._id, title, deletedAt: null },
        { $set: { content, updatedAt: new Date() } },
      );
    if (matchedCount !== 1) throw new Error(`No chapter ${title} in ${folder}`);
  });
}
