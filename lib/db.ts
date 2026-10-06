import mongoose from "mongoose";

const cache = globalThis as typeof globalThis & {
  mongooseConnection?: Promise<typeof mongoose>;
};

// Cached on globalThis so serverless invocations and dev hot reloads reuse one connection.
export function connectDB(): Promise<typeof mongoose> {
  if (!cache.mongooseConnection) {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("MONGODB_URI is not set");
    cache.mongooseConnection = mongoose.connect(uri).catch((error) => {
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
