import { AuthError } from "next-auth";
import { signIn } from "@/auth";

// After registering or resetting the password. False when only the sign-in limit stopped it:
// the account is fine, the user signs in by hand.
export async function signInAfter(
  nickname: string,
  password: string,
): Promise<boolean> {
  try {
    await signIn("credentials", { nickname, password, redirect: false });
    return true;
  } catch (error) {
    if (error instanceof AuthError) return false;
    throw error;
  }
}
