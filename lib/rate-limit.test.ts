import { afterEach, describe, expect, it, vi } from "vitest";
import { accountKey, clientIp } from "./rate-limit";

const headers = (values: Record<string, string>) => new Headers(values);

afterEach(() => vi.unstubAllEnvs());

describe("clientIp", () => {
  it("ignores X-Forwarded-For: the client sets it", () => {
    expect(clientIp(headers({ "x-forwarded-for": "203.0.113.7" }))).toBeNull();
    vi.stubEnv("VERCEL", "1");
    expect(clientIp(headers({ "x-forwarded-for": "203.0.113.7" }))).toBeNull();
  });

  it("is null without a trusted address, so no bucket is shared", () => {
    expect(clientIp(headers({}))).toBeNull();
    vi.stubEnv("VERCEL", "1");
    expect(clientIp(headers({}))).toBeNull();
  });

  describe("on Vercel", () => {
    const ip = (value: string) =>
      clientIp(
        headers({
          "x-vercel-forwarded-for": value,
          "x-forwarded-for": "198.51.100.1",
        }),
      );

    it("takes the platform's header and the first address in it", () => {
      vi.stubEnv("VERCEL", "1");
      expect(ip("203.0.113.7")).toBe("203.0.113.7");
      expect(ip("203.0.113.7, 10.0.0.1")).toBe("203.0.113.7");
    });

    it("unwraps IPv4-mapped addresses", () => {
      vi.stubEnv("VERCEL", "1");
      expect(ip("::ffff:203.0.113.7")).toBe("203.0.113.7");
    });

    it.each([
      ["2001:db8:1:2:3:4:5:6", "2001:db8:1:2::/64"],
      ["2001:db8:1:2::9", "2001:db8:1:2::/64"],
      ["2001:DB8::9", "2001:db8:0:0::/64"],
      ["::1", "0:0:0:0::/64"],
    ])("groups %s into its /64", (address, network) => {
      vi.stubEnv("VERCEL", "1");
      expect(ip(address)).toBe(network);
    });
  });

  it("an empty TRUSTED_IP_HEADER keeps Vercel's header", () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("TRUSTED_IP_HEADER", "");
    expect(
      clientIp(headers({ "x-vercel-forwarded-for": "203.0.113.7" })),
    ).toBe("203.0.113.7");
  });

  it("TRUSTED_IP_HEADER names the header elsewhere", () => {
    vi.stubEnv("TRUSTED_IP_HEADER", "x-real-ip");
    expect(
      clientIp(
        headers({
          "x-real-ip": "203.0.113.7",
          "x-vercel-forwarded-for": "1.1.1.1",
        }),
      ),
    ).toBe("203.0.113.7");
  });
});

describe("accountKey", () => {
  it("ignores case and surrounding spaces, like the nickname index", () => {
    expect(accountKey(" Alice ")).toBe(accountKey("aLICE"));
  });
});
