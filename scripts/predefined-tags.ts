import { connectDB, disconnectDB } from "@/lib/db";
import { inEnglish } from "@/lib/i18n/english";
import { removePredefinedTag, savePredefinedTag } from "@/lib/tags/mutations";
import { listPredefinedTags } from "@/lib/tags/queries";

// Removing a key leaves it in folders and chapters, where it becomes an own tag again (D79).
const USAGE = `Usage:
  npm run tags -- list
  npm run tags -- set <key> <English label> <Polish label>
  npm run tags -- remove <key>`;

async function main() {
  const [command, ...args] = process.argv.slice(2);
  await connectDB();

  if (command === "list" && args.length === 0) {
    for (const { key, labels } of await listPredefinedTags()) {
      console.log(`${key}\t${labels.en}\t${labels.pl}`);
    }
    return;
  }
  if (command === "set" && args.length === 3) {
    const [key, en, pl] = args;
    const error = await savePredefinedTag({ key, labels: { en, pl } });
    if (error) throw new Error(inEnglish(error));
    console.log(`Saved "${key}".`);
    return;
  }
  if (command === "remove" && args.length === 1) {
    const removed = await removePredefinedTag(args[0]);
    console.log(removed ? `Removed "${args[0]}".` : "No such key.");
    return;
  }
  console.log(USAGE);
  process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(disconnectDB);
