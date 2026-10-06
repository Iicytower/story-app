import { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveStory, setSharing } from "@/app/(protected)/stories/actions";
import type { ActionError } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import { Story } from "@/lib/models/story";
import { getSharedStory } from "@/lib/stories/queries";
import { setupTestDb } from "./test-db";

vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn() }));

setupTestDb();

const alice = new Types.ObjectId();
const bob = new Types.ObjectId();

const unauthorized: ActionError = {
  ok: false,
  error: "UNAUTHORIZED",
  message: "Your session has expired. Please sign in again.",
};

function signInAs(userId: Types.ObjectId | null) {
  vi.mocked(requireUser).mockResolvedValue(
    userId ? { ok: true, userId: userId.toString() } : unauthorized,
  );
}

beforeEach(() => signInAs(alice));

async function storedToken(id: Types.ObjectId) {
  const story = await Story.findById(id).lean();
  return story?.shareToken;
}

describe("setSharing", () => {
  it("enabling stores a random token of at least 16 characters and returns its path", async () => {
    const story = await Story.create({ userId: alice, title: "Shared" });

    const result = await setSharing(story._id.toString(), true);

    const token = await storedToken(story._id);
    expect(token).toMatch(/^[\w-]{16,}$/);
    expect(result).toEqual({ ok: true, sharePath: `/s/${token}` });
  });

  it("gives different stories different tokens", async () => {
    const a = await Story.create({ userId: alice, title: "A" });
    const b = await Story.create({ userId: alice, title: "B" });

    await setSharing(a._id.toString(), true);
    await setSharing(b._id.toString(), true);

    expect(await storedToken(a._id)).not.toBe(await storedToken(b._id));
  });

  it("enabling again keeps the existing token", async () => {
    const story = await Story.create({ userId: alice, title: "Shared" });
    const first = await setSharing(story._id.toString(), true);

    const [second, third] = await Promise.all([
      setSharing(story._id.toString(), true),
      setSharing(story._id.toString(), true),
    ]);

    expect(second).toEqual(first);
    expect(third).toEqual(first);
  });

  it("disabling removes the token field", async () => {
    const story = await Story.create({ userId: alice, title: "Shared" });
    await setSharing(story._id.toString(), true);

    const result = await setSharing(story._id.toString(), false);

    expect(result).toEqual({ ok: true, sharePath: null });
    const stored = await Story.findById(story._id).lean();
    expect(stored).not.toHaveProperty("shareToken");
  });

  it("enabling after disabling creates a new token", async () => {
    const story = await Story.create({ userId: alice, title: "Shared" });
    const first = await setSharing(story._id.toString(), true);
    await setSharing(story._id.toString(), false);

    const second = await setSharing(story._id.toString(), true);

    expect(second.ok && second.sharePath).not.toBe(
      first.ok && first.sharePath,
    );
  });

  it("does not change updatedAt, so the open editor can still save", async () => {
    const story = await Story.create({ userId: alice, title: "Shared" });
    const updatedAt = story.updatedAt.toISOString();

    await setSharing(story._id.toString(), true);
    await setSharing(story._id.toString(), false);

    expect((await Story.findById(story._id).lean())?.updatedAt).toEqual(
      story.updatedAt,
    );
    const saved = await saveStory(
      story._id.toString(),
      "Shared",
      "Text",
      "",
      updatedAt,
    );
    expect(saved.ok).toBe(true);
  });

  it.each([true, false])(
    "returns NOT_FOUND for another user's story (enabled: %s)",
    async (enabled) => {
      const story = await Story.create({
        userId: bob,
        title: "Bob's",
        ...(!enabled && { shareToken: "bob-token-1234567890" }),
      });

      const result = await setSharing(story._id.toString(), enabled);

      expect(result).toMatchObject({ ok: false, error: "NOT_FOUND" });
      expect(await storedToken(story._id)).toBe(
        enabled ? undefined : "bob-token-1234567890",
      );
    },
  );

  it.each([true, false])(
    "returns NOT_FOUND for a deleted story (enabled: %s)",
    async (enabled) => {
      const story = await Story.create({
        userId: alice,
        title: "Gone",
        deletedAt: new Date(),
      });

      const result = await setSharing(story._id.toString(), enabled);

      expect(result).toMatchObject({ ok: false, error: "NOT_FOUND" });
      expect(await storedToken(story._id)).toBeUndefined();
    },
  );

  it("returns NOT_FOUND for an invalid or unknown id", async () => {
    expect(await setSharing("not-an-id", true)).toMatchObject({
      error: "NOT_FOUND",
    });
    expect(
      await setSharing(new Types.ObjectId().toString(), true),
    ).toMatchObject({ error: "NOT_FOUND" });
  });

  it("returns UNAUTHORIZED without a session", async () => {
    const story = await Story.create({ userId: alice, title: "Mine" });
    signInAs(null);

    expect(await setSharing(story._id.toString(), true)).toEqual(unauthorized);
    expect(await storedToken(story._id)).toBeUndefined();
  });
});

describe("getSharedStory", () => {
  it("returns only the title and content", async () => {
    await Story.create({
      userId: alice,
      title: "Public",
      content: "Body",
      notes: "Private notes",
      shareToken: "public-token-1234567",
    });

    expect(await getSharedStory("public-token-1234567")).toStrictEqual({
      title: "Public",
      content: "Body",
    });
  });

  it("returns null for a deleted story", async () => {
    await Story.create({
      userId: alice,
      title: "Gone",
      shareToken: "deleted-token-123456",
      deletedAt: new Date(),
    });

    expect(await getSharedStory("deleted-token-123456")).toBeNull();
  });

  it("returns null for an unknown token", async () => {
    await Story.create({ userId: alice, title: "Private" });

    expect(await getSharedStory("unknown-token-123456")).toBeNull();
  });
});
