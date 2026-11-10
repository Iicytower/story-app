import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authorizeCredentials } from "@/lib/auth/authorize";
import { sessionCallbacks, sessionEvents } from "@/lib/auth/callbacks";
import { SESSION_MAX_AGE_S } from "@/lib/auth/sessions";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: { nickname: {}, password: {} },
      authorize: authorizeCredentials,
    }),
  ],
  // Every request through the proxy re-signs the JWT, so the 30 days restart on each visit.
  // Each JWT points to a stored session (D75), which signing out and password changes end.
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_S },
  // The proxy sends signed-out visitors to the sign-in dialog itself, with the locale.
  pages: { signIn: "/" },
  // Without it a local `next start` rejects every sign-in (Vercel already sets VERCEL).
  trustHost: true,
  callbacks: sessionCallbacks,
  events: sessionEvents,
});
