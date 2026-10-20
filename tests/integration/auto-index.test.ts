import mongoose from "mongoose";
import { afterAll, expect, it } from "vitest";
import { connectDB, disconnectDB } from "@/lib/db";
import { Story } from "@/lib/models/story";
import { User } from "@/lib/models/user";

// No setupTestDb: it builds the indexes itself.
const URI = `mongodb://127.0.0.1:27017/story_app_test_autoindex_${process.env.VITEST_POOL_ID ?? "0"}`;

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await disconnectDB();
});

it("does not create indexes when the app connects", async () => {
  process.env.MONGODB_URI = URI;
  const { connection } = await connectDB();
  await connection.dropDatabase();

  await Promise.all([Story.init(), User.init()]);
  const user = await User.create({ email: "a@example.com", passwordHash: "x" });
  await Story.create({ userId: user._id, title: "Title" });

  for (const model of [Story, User]) {
    const indexes = await model.collection.indexes();
    expect(indexes.map((index) => index.name)).toEqual(["_id_"]);
  }
});
