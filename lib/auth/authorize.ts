import bcrypt from "bcryptjs";
import { normalizeEmail } from "@/lib/accounts";
import { connectDB } from "@/lib/db";
import { User } from "@/lib/models/user";

export const LOGIN_DELAY_MS = 1500;

export interface AuthorizedUser {
  id: string;
  email: string;
}

async function verifyCredentials(
  email: unknown,
  password: unknown,
): Promise<AuthorizedUser | null> {
  if (typeof email !== "string" || typeof password !== "string") return null;
  await connectDB();
  const user = await User.findOne({ email: normalizeEmail(email) }).lean();
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return null;
  }
  return { id: user._id.toString(), email: user.email };
}

// Every outcome takes the same fixed time: slows down guessing and hides whether the email exists.
export async function authorizeCredentials(
  credentials: Partial<Record<string, unknown>>,
): Promise<AuthorizedUser | null> {
  const [user] = await Promise.all([
    verifyCredentials(credentials.email, credentials.password),
    new Promise((resolve) => setTimeout(resolve, LOGIN_DELAY_MS)),
  ]);
  return user;
}
