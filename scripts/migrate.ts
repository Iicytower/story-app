import path from "node:path";
import { connectDB, disconnectDB } from "@/lib/db";
import { decideMigration, loadMigrations, runMigrations } from "@/lib/migrate";
import "@/lib/models";

async function main() {
  const decision = decideMigration(process.env);
  if (!decision.run) {
    console.log(decision.reason);
    return;
  }
  const migrations = await loadMigrations(
    path.join(process.cwd(), "migrations"),
  );
  const { connection } = await connectDB();
  await runMigrations(connection, migrations);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(disconnectDB);
