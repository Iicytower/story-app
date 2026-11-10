import { execFileSync } from "node:child_process";
import { createOrUpdateUser } from "@/lib/accounts";
import { connectDB, disconnectDB } from "@/lib/db";
import "@/lib/models";
import { NICKNAME_COLLATION, User } from "@/lib/models/user";
import { up as seedPredefinedTags } from "@/migrations/007-predefined-tags";
import { E2E_MONGODB_URI, USERS } from "./env";

export default async function globalSetup() {
  execFileSync("docker", ["compose", "up", "-d", "--wait", "mongo"], {
    stdio: "inherit",
  });

  process.env.MONGODB_URI = E2E_MONGODB_URI;
  const { connection } = await connectDB();
  await connection.dropDatabase();
  await connection.syncIndexes();
  await seedPredefinedTags(connection.db!);
  for (const user of Object.values(USERS)) {
    await createOrUpdateUser(user.nickname, user.password);
    if ("role" in user) {
      await User.updateOne(
        { nickname: user.nickname },
        { $set: { role: user.role } },
      ).collation(NICKNAME_COLLATION);
    }
  }
  await disconnectDB();
}
