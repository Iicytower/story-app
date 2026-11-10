import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
    // The stored session (D75), so actions can keep it when they end the others.
    sid?: string;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    sid?: string;
  }
}
