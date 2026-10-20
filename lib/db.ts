import mongoose from "mongoose";

const cache = globalThis as typeof globalThis & {
  mongooseConnection?: Promise<typeof mongoose>;
};

// Cached on globalThis so serverless invocations and dev hot reloads reuse one connection.
export function connectDB(): Promise<typeof mongoose> {
  if (!cache.mongooseConnection) {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("MONGODB_URI is not set");
    // Indexes are managed only by the migration script (scripts/migrate.ts); otherwise an old
    // deployment would recreate dropped indexes on a cold start.
    cache.mongooseConnection = mongoose
      .connect(uri, { autoIndex: false })
      .catch((error) => {
        cache.mongooseConnection = undefined;
        throw error;
      });
  }
  return cache.mongooseConnection;
}

export async function disconnectDB(): Promise<void> {
  cache.mongooseConnection = undefined;
  await mongoose.disconnect();
}

export function isDuplicateKeyError(error: unknown): boolean {
  return (
    error instanceof mongoose.mongo.MongoServerError && error.code === 11000
  );
}
