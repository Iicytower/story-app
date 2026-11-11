import { describe, expect, it } from "vitest";
import { contentSecurityPolicy } from "./security-headers";

const connectSrc = (policy: string) =>
  policy.split("; ").find((part) => part.startsWith("connect-src"));

describe("connect-src (D77, task 90)", () => {
  it("is only the app without the realtime address", () => {
    expect(connectSrc(contentSecurityPolicy("n", false))).toBe(
      "connect-src 'self'",
    );
    expect(connectSrc(contentSecurityPolicy("n", true))).toBe(
      "connect-src 'self' ws:",
    );
  });

  it("adds only the origin of the realtime address (5)", () => {
    expect(
      connectSrc(
        contentSecurityPolicy("n", false, "https://tools.example:8443/base"),
      ),
    ).toBe("connect-src 'self' https://tools.example:8443");
    expect(
      connectSrc(contentSecurityPolicy("n", true, "http://127.0.0.1:8110")),
    ).toBe("connect-src 'self' http://127.0.0.1:8110 ws:");
  });
});
