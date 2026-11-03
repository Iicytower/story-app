import { describe, expect, it } from "vitest";
import { clientIp } from "./rate-limit";

function ip(forwardedFor?: string) {
  return clientIp(
    new Headers(forwardedFor ? { "x-forwarded-for": forwardedFor } : {}),
  );
}

describe("clientIp", () => {
  it("takes the first address of the chain", () => {
    expect(ip("203.0.113.7, 10.0.0.1")).toBe("203.0.113.7");
  });

  it("shares one bucket without the header", () => {
    expect(ip()).toBe("unknown");
  });

  it("unwraps IPv4-mapped addresses", () => {
    expect(ip("::ffff:203.0.113.7")).toBe("203.0.113.7");
  });

  it.each([
    ["2001:db8:1:2:3:4:5:6", "2001:db8:1:2::/64"],
    ["2001:db8:1:2::9", "2001:db8:1:2::/64"],
    ["2001:DB8::9", "2001:db8:0:0::/64"],
    ["::1", "0:0:0:0::/64"],
  ])("groups %s into its /64", (address, network) => {
    expect(ip(address)).toBe(network);
  });
});
