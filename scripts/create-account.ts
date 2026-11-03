import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { createOrUpdateUser, userExists } from "@/lib/accounts";
import { nicknameError, passwordError } from "@/lib/credentials";
import { inEnglish } from "@/lib/i18n/english";
import { connectDB, disconnectDB } from "@/lib/db";

// readline echoes typed characters through its output stream; muting it hides the password.
let muted = false;
const output = new Writable({
  write(chunk, encoding, callback) {
    if (!muted) stdout.write(chunk, encoding);
    callback();
  },
});
const rl = createInterface({ input: stdin, output, terminal: true });

async function askHidden(question: string): Promise<string> {
  stdout.write(question);
  muted = true;
  const answer = await rl.question("");
  muted = false;
  stdout.write("\n");
  return answer;
}

async function askNickname(): Promise<string> {
  for (;;) {
    const nickname = (await rl.question("Nickname: ")).trim();
    const error = nicknameError(nickname);
    if (!error) return nickname;
    console.log(`${inEnglish(error)} Try again.`);
  }
}

async function askPassword(): Promise<string> {
  for (;;) {
    const password = await askHidden("Password: ");
    const error = passwordError(password);
    if (error) {
      console.log(`${inEnglish(error)} Try again.`);
      continue;
    }
    if (password === (await askHidden("Repeat password: "))) return password;
    console.log("Passwords do not match, try again.");
  }
}

async function main() {
  await connectDB();
  const nickname = await askNickname();

  if (await userExists(nickname)) {
    const answer = await rl.question(
      `Account ${nickname} already exists. Change its password? [y/N] `,
    );
    if (answer.trim().toLowerCase() !== "y") {
      console.log("No changes made.");
      return;
    }
  }

  const result = await createOrUpdateUser(nickname, await askPassword());
  console.log(
    result === "created"
      ? `Account ${nickname} created.`
      : `Password for ${nickname} changed.`,
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    rl.close();
    await disconnectDB();
  });
