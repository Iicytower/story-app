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
  });
}

export function seedStory(
  user: UserName,
  story: {
    title: string;
    content?: string;
    notes?: string;
    updatedAt?: Date;
    deletedAt?: Date;
  },
): Promise<string> {
  return withE2EDb(async (connection) => {
    const account = await connection
      .collection("users")
      .findOne({ email: USERS[user].email });
    if (!account) throw new Error(`User ${user} is not seeded`);
    const now = new Date();
    const { insertedId } = await connection.collection("stories").insertOne({
      userId: account._id,
      title: story.title,
      content: story.content ?? "",
      notes: story.notes ?? "",
      deletedAt: story.deletedAt ?? null,
      createdAt: now,
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
