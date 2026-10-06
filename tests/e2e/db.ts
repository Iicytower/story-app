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
  story: { title: string; content?: string; updatedAt?: Date },
): Promise<void> {
  return withE2EDb(async (connection) => {
    const account = await connection
      .collection("users")
      .findOne({ email: USERS[user].email });
    if (!account) throw new Error(`User ${user} is not seeded`);
    const now = new Date();
    await connection.collection("stories").insertOne({
      userId: account._id,
      title: story.title,
      content: story.content ?? "",
      notes: "",
      deletedAt: null,
      createdAt: now,
      updatedAt: story.updatedAt ?? now,
    });
  });
}

export function findStory(
  title: string,
): Promise<{ deletedAt: Date | null } | null> {
  return withE2EDb((connection) =>
    connection
      .collection<{ deletedAt: Date | null }>("stories")
      .findOne({ title }),
  );
}
