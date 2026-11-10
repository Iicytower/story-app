import { describe, expect, it } from "vitest";
import { isPublicPath } from "./public-paths";

describe("isPublicPath", () => {
  it.each([
    "/en",
    "/en/",
    "/en/login",
    "/en/register",
    "/api/auth/session",
    "/api/auth/callback/credentials",
    "/en/p/alice",
    "/en/p/alice/book",
    "/en/p/alice/book/chapter",
    "/avatars/abc",
  ])("%s is public", (path) => expect(isPublicPath(path)).toBe(true));

  it.each([
    "/",
    "/p/alice/book",
    "/xx",
    "/xx/p/alice/book",
    "/en/stories",
    "/en/stories/123",
    "/stories/123/export",
    "/en/login/x",
    "/en/register/x",
    "/en/s/abc123",
    "/en/p",
    "/avatars/abc/x",
    "/en/p/alice/book/chapter/x",
    "/api/other",
  ])("%s requires a session", (path) => expect(isPublicPath(path)).toBe(false));
});
