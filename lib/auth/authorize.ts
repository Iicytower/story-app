import { CredentialsSignin } from "next-auth";
import { findUserByNickname, verifyPassword } from "@/lib/accounts";
import { connectDB } from "@/lib/db";
import {
  clientIp,
  giveBackAttempt,
  LOGIN_LIMIT,
  takeAttempt,
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
  ip: string,
): Promise<AuthorizedUser | null> {
  if (typeof nickname !== "string" || typeof password !== "string") return null;
  await connectDB();
  // Here and not in the login action: /api/auth/callback/credentials can be called directly.
  const attempt = await takeAttempt(LOGIN_LIMIT, ip);
  if (!attempt) throw new LoginRateLimited();
  const user = await findUserByNickname(nickname);
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return null;
  }
  await giveBackAttempt(attempt);
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
      clientIp(request?.headers ?? new Headers()),
    ),
    new Promise((resolve) => setTimeout(resolve, LOGIN_DELAY_MS)),
  ]);
  return user;
}
