import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authorizeCredentials } from "@/lib/auth/authorize";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: { nickname: {}, password: {} },
      authorize: authorizeCredentials,
    }),
  ],
  // Every request through the proxy re-signs the JWT, so the 30 days restart on each visit.
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  // The proxy sends signed-out visitors to the sign-in dialog itself, with the locale.
  pages: { signIn: "/" },
  // Without it a local `next start` rejects every sign-in (Vercel already sets VERCEL).
  trustHost: true,
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id;
      return session;
    },
  },
});
