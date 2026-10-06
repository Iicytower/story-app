import { describe, expect, it } from "vitest";
import { isPublicPath } from "./public-paths";

describe("isPublicPath", () => {
  it.each([
    "/login",
    "/api/auth/session",
    "/api/auth/callback/credentials",
    "/s/abc123",
  ])("%s is public", (path) => expect(isPublicPath(path)).toBe(true));

  it.each([
    "/",
    "/stories",
    "/stories/123",
    "/stories/123/export",
    "/login/x",
    "/s",
    "/s/a/b",
    "/api/other",
  ])("%s requires a session", (path) => expect(isPublicPath(path)).toBe(false));
});
