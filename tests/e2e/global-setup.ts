import { execFileSync } from "node:child_process";
import { createOrUpdateUser } from "@/lib/accounts";
import { connectDB, disconnectDB } from "@/lib/db";
import "@/lib/models/story";
import "@/lib/models/user";
import { E2E_MONGODB_URI, USERS } from "./env";

export default async function globalSetup() {
  execFileSync("docker", ["compose", "up", "-d", "--wait", "mongo"], {
    stdio: "inherit",
  });

  process.env.MONGODB_URI = E2E_MONGODB_URI;
  const { connection } = await connectDB();
  await connection.dropDatabase();
  await connection.syncIndexes();
  for (const { email, password } of Object.values(USERS)) {
    await createOrUpdateUser(email, password);
  }
  await disconnectDB();
}
