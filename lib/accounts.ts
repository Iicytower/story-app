import bcrypt from "bcryptjs";
import { User } from "@/lib/models/user";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function userExists(email: string): Promise<boolean> {
  return (await User.exists({ email: normalizeEmail(email) })) !== null;
}

export async function createOrUpdateUser(
  email: string,
  password: string,
): Promise<"created" | "updated"> {
  const passwordHash = await bcrypt.hash(password, 12);
  const result = await User.updateOne(
    { email: normalizeEmail(email) },
    { $set: { passwordHash } },
    { upsert: true },
  );
  return result.upsertedCount > 0 ? "created" : "updated";
}
