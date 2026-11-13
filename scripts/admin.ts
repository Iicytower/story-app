import { findUserByNickname } from "@/lib/accounts";
import { connectDB, disconnectDB } from "@/lib/db";
import { NICKNAME_COLLATION, User } from "@/lib/models/user";

const USAGE = `Usage:
  npm run admin -- list
  npm run admin -- add <nickname>
  npm run admin -- remove <nickname>`;

async function main() {
  const [command, ...args] = process.argv.slice(2);
  await connectDB();

  if (command === "list" && args.length === 0) {
    const admins = await User.find({ role: "admin" }, { nickname: 1 })
      .collation(NICKNAME_COLLATION)
      .sort({ nickname: 1 })
      .lean();
    for (const { nickname } of admins) console.log(nickname);
    return;
  }
  if ((command === "add" || command === "remove") && args.length === 1) {
    const user = await findUserByNickname(args[0]);
    if (!user) throw new Error(`No account with the nickname "${args[0]}".`);
    await User.updateOne(
      { _id: user._id },
      command === "add" ? { $set: { role: "admin" } } : { $unset: { role: 1 } },
    );
    console.log(
      command === "add"
        ? `"${user.nickname}" is an admin.`
        : `"${user.nickname}" is no longer an admin.`,
    );
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
