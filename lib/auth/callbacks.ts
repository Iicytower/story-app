import type { NextAuthConfig } from "next-auth";
import { createSession, endSession, isSessionActive } from "./sessions";

// Kept out of auth.ts so the integration tests can call them without Next.js.
export const sessionCallbacks = {
  async jwt({ token, user }) {
    if (user?.id) {
      token.id = user.id;
      token.sid = await createSession(user.id);
      return token;
    }
    // Null ends the session: Auth.js clears the cookie. Tokens from before D75 have no sid.
    return (await isSessionActive(token.sid, token.id)) ? token : null;
  },
  session({ session, token }) {
    if (token.id) session.user.id = token.id;
    if (token.sid) session.sid = token.sid;
    return session;
  },
} satisfies NextAuthConfig["callbacks"];

export const sessionEvents = {
  // Signing out deletes the stored session, so a copied cookie stops working too.
  async signOut(message) {
    if ("token" in message) await endSession(message.token?.sid);
  },
} satisfies NextAuthConfig["events"];
