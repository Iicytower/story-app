import { CredentialsSignin } from "next-auth";
import { findUserByNickname, verifyPassword } from "@/lib/accounts";
import { connectDB } from "@/lib/db";
import {
  accountKey,
  giveBackAttempt,
  LOGIN_ACCOUNT_LIMIT,
  LOGIN_LIMIT,
  takeAttempt,
  takeIpAttempt,
} from "@/lib/rate-limit";

export const LOGIN_DELAY_MS = 1500;

export class LoginRateLimited extends CredentialsSignin {
  code = "rate_limited";
}

export interface AuthorizedUser {
  id: string;
  name: string;
}

async function verifyCredentials(
  nickname: unknown,
  password: unknown,
  headers: Headers,
): Promise<AuthorizedUser | null> {
  if (typeof nickname !== "string" || typeof password !== "string") return null;
  await connectDB();
  // Here and not in the login action: /api/auth/callback/credentials can be called directly.
  const fromAddress = await takeIpAttempt(LOGIN_LIMIT, headers);
  if (!fromAddress) throw new LoginRateLimited();
  // Counted for nicknames without an account too, so the answer does not tell them apart.
  const forAccount = await takeAttempt(
    LOGIN_ACCOUNT_LIMIT,
    accountKey(nickname),
  );
  if (!forAccount) throw new LoginRateLimited();
  const user = await findUserByNickname(nickname);
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return null;
  }
  await giveBackAttempt(fromAddress.slot);
  await giveBackAttempt(forAccount);
  return { id: user._id.toString(), name: user.nickname };
}

// Every outcome takes the same fixed time: slows down guessing and hides whether the nickname exists.
export async function authorizeCredentials(
  credentials: Partial<Record<string, unknown>>,
  request?: Request,
): Promise<AuthorizedUser | null> {
  const [user] = await Promise.all([
    verifyCredentials(
      credentials.nickname,
      credentials.password,
      request?.headers ?? new Headers(),
    ),
    new Promise((resolve) => setTimeout(resolve, LOGIN_DELAY_MS)),
  ]);
  return user;
}
