import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach } from "vitest";
import { connectDB, disconnectDB } from "@/lib/db";
import "@/lib/models/story";
import "@/lib/models/user";

// Separate database per Vitest worker on the Docker instance; never the one from .env.local.
const TEST_URI = `mongodb://127.0.0.1:27017/story_app_test_${process.env.VITEST_POOL_ID ?? "0"}`;

export function setupTestDb() {
  beforeAll(async () => {
    process.env.MONGODB_URI = TEST_URI;
    const { connection } = await connectDB();
    await connection.dropDatabase();
    await connection.syncIndexes();
  });

  beforeEach(async () => {
    const collections = Object.values(mongoose.connection.collections);
    await Promise.all(
      collections.map((collection) => collection.deleteMany({})),
    );
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await disconnectDB();
  });
}
