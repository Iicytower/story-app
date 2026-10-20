import { describe, expect, it } from "vitest";
import { isPublicPath } from "./public-paths";

describe("isPublicPath", () => {
  it.each([
    "/login",
    "/api/auth/session",
    "/api/auth/callback/credentials",
    "/s/abc123",
    "/s/f/abc123",
    "/s/f/abc123/2",
  ])("%s is public", (path) => expect(isPublicPath(path)).toBe(true));

  it.each([
    "/",
    "/stories",
    "/stories/123",
    "/stories/123/export",
    "/login/x",
    "/s",
    "/s/a/b",
    "/s/f/abc123/x",
    "/s/f/abc123/2/3",
    "/api/other",
  ])("%s requires a session", (path) => expect(isPublicPath(path)).toBe(false));
});
