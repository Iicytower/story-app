import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { avatarColor, initials, UserAvatar } from "./user-avatar";

describe("UserAvatar", () => {
  it("shows the initials on the nickname's colour without an avatar", () => {
    const html = renderToStaticMarkup(
      <UserAvatar nickname="Alice" src={null} alt="Avatar of Alice" />,
    );
    expect(html).not.toContain("<img");
    expect(html).toContain(">A</span>");
    expect(html).toContain('aria-label="Avatar of Alice"');
    expect(html).toContain(`background-color:${avatarColor("Alice")}`);
  });

  it("shows the image when there is one", () => {
    const html = renderToStaticMarkup(
      <UserAvatar nickname="Alice" src="/avatars/1" alt="Avatar of Alice" />,
    );
    expect(html).toContain('src="/avatars/1"');
    expect(html).toContain('alt="Avatar of Alice"');
  });

  it("takes the first letters of up to two words", () => {
    expect(initials("alice")).toBe("A");
    expect(initials("john_doe")).toBe("JD");
    expect(initials("Łucja-ma-kota")).toBe("ŁM");
    expect(initials("__")).toBe("?");
  });

  it("gives a nickname the same colour every time, whatever its case", () => {
    expect(avatarColor("Alice")).toBe(avatarColor("Alice"));
    expect(avatarColor("Alice")).toBe(avatarColor("alice"));
    expect(avatarColor("Alice")).toMatch(/^hsl\(\d+ 55% 38%\)$/);
    const colours = new Set(
      ["Alice", "Bob", "Carol", "Dave", "Erin"].map(avatarColor),
    );
    expect(colours.size).toBeGreaterThan(1);
  });
});
