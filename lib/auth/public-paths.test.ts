import { describe, expect, it } from "vitest";
import { isPublicPath } from "./public-paths";

describe("isPublicPath", () => {
  it.each([
    "/login",
    "/register",
    "/api/auth/session",
    "/api/auth/callback/credentials",
    "/p/alice/book",
    "/p/alice/book/chapter",
  ])("%s is public", (path) => expect(isPublicPath(path)).toBe(true));

  it.each([
    "/",
    "/stories",
    "/stories/123",
    "/stories/123/export",
    "/login/x",
    "/register/x",
    "/s/abc123",
    "/s/f/abc123",
    "/s/f/abc123/2",
    "/p",
    "/p/alice",
    "/p/alice/book/chapter/x",
    "/api/other",
  ])("%s requires a session", (path) => expect(isPublicPath(path)).toBe(false));
});
