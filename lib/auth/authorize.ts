import { findUserByNickname, verifyPassword } from "@/lib/accounts";
import { connectDB } from "@/lib/db";

export const LOGIN_DELAY_MS = 1500;

export interface AuthorizedUser {
  id: string;
  name: string;
}

async function verifyCredentials(
  nickname: unknown,
  password: unknown,
): Promise<AuthorizedUser | null> {
  if (typeof nickname !== "string" || typeof password !== "string") return null;
  await connectDB();
  const user = await findUserByNickname(nickname);
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return null;
  }
  return { id: user._id.toString(), name: user.nickname };
}

// Every outcome takes the same fixed time: slows down guessing and hides whether the nickname exists.
export async function authorizeCredentials(
  credentials: Partial<Record<string, unknown>>,
): Promise<AuthorizedUser | null> {
  const [user] = await Promise.all([
    verifyCredentials(credentials.nickname, credentials.password),
    new Promise((resolve) => setTimeout(resolve, LOGIN_DELAY_MS)),
  ]);
  return user;
}
