import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { createOrUpdateUser, normalizeEmail, userExists } from "@/lib/accounts";
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

async function askEmail(): Promise<string> {
  for (;;) {
    const email = normalizeEmail(await rl.question("Email: "));
    if (email.includes("@")) return email;
    console.log("Invalid email, try again.");
  }
}

async function askPassword(): Promise<string> {
  for (;;) {
    const password = await askHidden("Password: ");
    if (!password) {
      console.log("Password cannot be empty, try again.");
      continue;
    }
    if (password === (await askHidden("Repeat password: "))) return password;
    console.log("Passwords do not match, try again.");
  }
}

async function main() {
  await connectDB();
  const email = await askEmail();

  if (await userExists(email)) {
    const answer = await rl.question(
      `Account ${email} already exists. Change its password? [y/N] `,
    );
    if (answer.trim().toLowerCase() !== "y") {
      console.log("No changes made.");
      return;
    }
  }

  const result = await createOrUpdateUser(email, await askPassword());
  console.log(
    result === "created"
      ? `Account ${email} created.`
      : `Password for ${email} changed.`,
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
