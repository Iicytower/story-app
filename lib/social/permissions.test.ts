import { describe, expect, it } from "vitest";
import {
  decideInteraction,
  decideModeration,
  type InteractionFacts,
  type InteractionKind,
  isAdmin,
  isBanActive,
} from "./permissions";

const NOW = new Date("2026-11-10T12:00:00Z");
const PAST = new Date("2026-11-09T12:00:00Z");
const FUTURE = new Date("2026-11-11T12:00:00Z");

const NONE: InteractionFacts = {
  actor: {},
  author: {},
  communityBan: null,
  blocked: false,
};
const ALLOWED = { ok: true };
const FORBIDDEN = {
  ok: false,
  error: "FORBIDDEN",
  key: "interactionNotAllowed",
};
const NOT_FOUND = { ok: false, error: "NOT_FOUND", key: "userNotFound" };

const ALL_KINDS: InteractionKind[] = [
  "comment",
  "reply",
  "react",
  "rate",
  "forumPost",
  "dm",
  "follow",
  "mention",
];
const COMMUNITY_KINDS: InteractionKind[] = [
  "comment",
  "react",
  "rate",
  "forumPost",
];

describe("decideInteraction", () => {
  it.each(ALL_KINDS)("allows %s without any relation", (kind) => {
    expect(decideInteraction(NONE, kind, NOW)).toEqual(ALLOWED);
  });

  it.each([
    ["without end", null],
    ["until later", FUTURE],
  ])("refuses every kind under a global ban %s", (_, until) => {
    const facts = { ...NONE, actor: { globalBan: { until } } };
    for (const kind of ALL_KINDS) {
      expect(decideInteraction(facts, kind, NOW)).toEqual(FORBIDDEN);
    }
  });

  it("allows again after a global ban expired", () => {
    const facts = { ...NONE, actor: { globalBan: { until: PAST } } };
    for (const kind of ALL_KINDS) {
      expect(decideInteraction(facts, kind, NOW)).toEqual(ALLOWED);
    }
  });

  it.each([
    ["without end", null],
    ["until later", FUTURE],
  ])("refuses the community under a community ban %s", (_, until) => {
    const facts = { ...NONE, communityBan: { until } };
    for (const kind of COMMUNITY_KINDS) {
      expect(decideInteraction(facts, kind, NOW)).toEqual(FORBIDDEN);
    }
  });

  it.each(["reply", "dm", "follow", "mention"] as const)(
    "leaves %s to a community-banned user",
    (kind) => {
      const facts = { ...NONE, communityBan: { until: null } };
      expect(decideInteraction(facts, kind, NOW)).toEqual(ALLOWED);
    },
  );

  it("allows again after a community ban expired", () => {
    const facts = { ...NONE, communityBan: { until: PAST } };
    for (const kind of ALL_KINDS) {
      expect(decideInteraction(facts, kind, NOW)).toEqual(ALLOWED);
    }
  });

  it("refuses every kind across a block", () => {
    const facts = { ...NONE, blocked: true };
    for (const kind of ALL_KINDS) {
      expect(decideInteraction(facts, kind, NOW)).toEqual(FORBIDDEN);
    }
  });

  it("does not find a missing or globally banned author", () => {
    expect(
      decideInteraction({ ...NONE, author: null }, "comment", NOW),
    ).toEqual(NOT_FOUND);
    expect(
      decideInteraction(
        { ...NONE, author: { globalBan: { until: null } } },
        "comment",
        NOW,
      ),
    ).toEqual(NOT_FOUND);
  });

  it("refuses every kind to a deleted actor", () => {
    const facts = { ...NONE, actor: { deletedAt: PAST } };
    for (const kind of ALL_KINDS) {
      expect(decideInteraction(facts, kind, NOW)).toEqual(FORBIDDEN);
    }
  });

  it("does not find a deleted author for a message, but allows the rest", () => {
    const facts = { ...NONE, author: { deletedAt: PAST } };
    for (const kind of ALL_KINDS) {
      expect(decideInteraction(facts, kind, NOW)).toEqual(
        kind === "dm" ? NOT_FOUND : ALLOWED,
      );
    }
  });

  it("allows acting on one's own content", () => {
    const self = { ...NONE, author: {} };
    for (const kind of ALL_KINDS) {
      expect(decideInteraction(self, kind, NOW)).toEqual(ALLOWED);
    }
  });

  it("refuses one's own content under one's own global ban, not as missing", () => {
    const self = { ...NONE, actor: { globalBan: { until: null } }, author: {} };
    for (const kind of ALL_KINDS) {
      expect(decideInteraction(self, kind, NOW)).toEqual(FORBIDDEN);
    }
  });
});

describe("isBanActive", () => {
  it("counts a ban without end and one until later, not an expired one", () => {
    expect(isBanActive({ until: null }, NOW)).toBe(true);
    expect(isBanActive({ until: FUTURE }, NOW)).toBe(true);
    expect(isBanActive({ until: PAST }, NOW)).toBe(false);
    expect(isBanActive({ until: NOW }, NOW)).toBe(false);
    expect(isBanActive(undefined, NOW)).toBe(false);
  });
});

describe("isAdmin", () => {
  it("is true only for the admin role", () => {
    expect(isAdmin({ role: "admin" })).toBe(true);
    expect(isAdmin({})).toBe(false);
    expect(isAdmin(null)).toBe(false);
  });
});

describe("decideModeration (task 79)", () => {
  const CANNOT = { ok: false, error: "FORBIDDEN", key: "cannotModerate" };
  const facts = {
    self: false,
    targetIsAuthor: false,
    targetIsModerator: false,
  };

  it("lets the author and a moderator hide and ban a reader", () => {
    for (const role of ["author", "moderator"] as const) {
      for (const action of ["hide", "ban"] as const) {
        expect(decideModeration({ ...facts, role }, action)).toEqual(ALLOWED);
      }
    }
  });

  it("refuses oneself and the author for everyone", () => {
    for (const role of ["author", "moderator"] as const) {
      expect(decideModeration({ ...facts, role, self: true }, "hide")).toEqual(
        CANNOT,
      );
      expect(
        decideModeration({ ...facts, role, targetIsAuthor: true }, "ban"),
      ).toEqual(CANNOT);
    }
  });

  it("a moderator never moderates a moderator; the author hides but does not ban one", () => {
    const moderator = { ...facts, targetIsModerator: true };
    expect(
      decideModeration({ ...moderator, role: "moderator" }, "hide"),
    ).toEqual(CANNOT);
    expect(
      decideModeration({ ...moderator, role: "moderator" }, "ban"),
    ).toEqual(CANNOT);
    expect(decideModeration({ ...moderator, role: "author" }, "hide")).toEqual(
      ALLOWED,
    );
    expect(decideModeration({ ...moderator, role: "author" }, "ban")).toEqual(
      CANNOT,
    );
  });
});
