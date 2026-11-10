import { connectDB, disconnectDB } from "@/lib/db";
import { PredefinedTag } from "@/lib/models/predefined-tag";
import { predefinedTagError } from "@/lib/tags/predefined";
import { listPredefinedTags } from "@/lib/tags/queries";

// Removing a key leaves it in folders and chapters, where it becomes an own tag again (D79).
const USAGE = `Usage:
  npm run tags -- list
  npm run tags -- set <key> <English label> <Polish label>
  npm run tags -- remove <key>`;

async function main() {
  const [command, ...args] = process.argv.slice(2);
  await connectDB();
  const tags = await listPredefinedTags();

  if (command === "list" && args.length === 0) {
    for (const { key, labels } of tags) {
      console.log(`${key}\t${labels.en}\t${labels.pl}`);
    }
    return;
  }
  if (command === "set" && args.length === 3) {
    const [key, en, pl] = args;
    const entry = { key, labels: { en: en.trim(), pl: pl.trim() } };
    const error = predefinedTagError(entry, tags);
    if (error) throw new Error(error);
    await PredefinedTag.updateOne(
      { _id: key },
      { $set: { labels: entry.labels } },
      { upsert: true },
    );
    console.log(`Saved "${key}".`);
    return;
  }
  if (command === "remove" && args.length === 1) {
    const { deletedCount } = await PredefinedTag.deleteOne({ _id: args[0] });
    console.log(deletedCount ? `Removed "${args[0]}".` : "No such key.");
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
