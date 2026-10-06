import { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveStory } from "@/app/(protected)/stories/actions";
import type { ActionError } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import { Story } from "@/lib/models/story";
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

async function seed(
  fields: {
    userId?: Types.ObjectId;
    title?: string;
    content?: string;
    notes?: string;
    deletedAt?: Date;
  } = {},
) {
  const story = await Story.create({
    userId: alice,
    title: "Story",
    content: "Original content",
    notes: "Original notes",
    ...fields,
  });
  const doc = (await Story.findById(story._id).lean())!;
  return {
    id: doc._id.toString(),
    updatedAt: doc.updatedAt.toISOString(),
    doc,
  };
}

function load(id: string) {
  return Story.findById(id).lean();
}

describe("saveStory", () => {
  it("saves title, content and notes and returns a newer updatedAt", async () => {
    const { id, updatedAt } = await seed();

    const result = await saveStory(
      id,
      "  New title ",
      "New content",
      "New notes",
      updatedAt,
    );

    expect(result.ok).toBe(true);
    const newUpdatedAt = result.ok ? result.updatedAt : "";
    expect(new Date(newUpdatedAt).getTime()).toBeGreaterThan(
      new Date(updatedAt).getTime(),
    );
    expect(await load(id)).toMatchObject({
      title: "New title",
      content: "New content",
      notes: "New notes",
      updatedAt: new Date(newUpdatedAt),
    });
  });

  it("accepts the returned updatedAt for the next save", async () => {
    const { id, updatedAt } = await seed();

    const first = await saveStory(id, "Story", "One", "", updatedAt);
    const second = await saveStory(
      id,
      "Story",
      "Two",
      "",
      first.ok ? first.updatedAt : "",
    );

    expect(second.ok).toBe(true);
    expect((await load(id))?.content).toBe("Two");
  });

  it("returns CONFLICT for an older expectedUpdatedAt and leaves the story intact", async () => {
    const { id, updatedAt, doc } = await seed();
    await saveStory(id, "Story", "From another tab", "", updatedAt);
    const before = await load(id);

    expect(await saveStory(id, "Story", "Stale", "", updatedAt)).toMatchObject({
      ok: false,
      error: "CONFLICT",
    });
    expect(await load(id)).toEqual(before);
    expect(before?.content).not.toBe(doc.content);
  });

  it("lets exactly one of two parallel saves with the same updatedAt succeed", async () => {
    const { id, updatedAt } = await seed();

    const results = await Promise.all([
      saveStory(id, "Story", "Tab A", "", updatedAt),
      saveStory(id, "Story", "Tab B", "", updatedAt),
    ]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok)).toMatchObject([
      { error: "CONFLICT" },
    ]);
    const winner = results[0].ok ? "Tab A" : "Tab B";
    expect((await load(id))?.content).toBe(winner);
  });

  describe("EMPTY_CONTENT", () => {
    it.each(["", "  \n\t "])(
      "rejects replacing non-empty content with %j",
      async (content) => {
        const { id, updatedAt, doc } = await seed();

        expect(
          await saveStory(id, "Changed", content, "Changed", updatedAt),
        ).toMatchObject({ ok: false, error: "EMPTY_CONTENT" });
        expect(await load(id)).toEqual(doc);
      },
    );

    it("allows the first save of content into an empty story", async () => {
      const { id, updatedAt } = await seed({ content: "" });

      expect(
        await saveStory(id, "Story", "First words", "", updatedAt),
      ).toMatchObject({ ok: true });
      expect((await load(id))?.content).toBe("First words");
    });

    it("allows saving empty content over empty content", async () => {
      const { id, updatedAt } = await seed({ content: "" });

      expect(
        await saveStory(id, "Renamed", "", "Some notes", updatedAt),
      ).toMatchObject({ ok: true });
      expect(await load(id)).toMatchObject({
        title: "Renamed",
        content: "",
        notes: "Some notes",
      });
    });
  });

  it.each(["", "   "])(
    "returns EMPTY_TITLE for %j and saves nothing",
    async (title) => {
      const { id, updatedAt, doc } = await seed();

      expect(
        await saveStory(id, title, "New content", "New notes", updatedAt),
      ).toMatchObject({ ok: false, error: "EMPTY_TITLE" });
      expect(await load(id)).toEqual(doc);
    },
  );

  it("returns DUPLICATE_TITLE and saves nothing, including the content", async () => {
    await seed({ title: "Taken" });
    const { id, updatedAt, doc } = await seed({ title: "Mine" });

    expect(
      await saveStory(id, " Taken ", "New content", "New notes", updatedAt),
    ).toMatchObject({ ok: false, error: "DUPLICATE_TITLE" });
    expect(await load(id)).toEqual(doc);
  });

  it("allows the title of a deleted story or of another user's story", async () => {
    await seed({ title: "Deleted", deletedAt: new Date() });
    await seed({ title: "Bob's", userId: bob });
    const { id, updatedAt } = await seed({ title: "Mine" });

    const first = await saveStory(id, "Deleted", "x", "", updatedAt);
    expect(first).toMatchObject({ ok: true });
    expect(
      await saveStory(id, "Bob's", "x", "", first.ok ? first.updatedAt : ""),
    ).toMatchObject({ ok: true });
  });

  it("returns NOT_FOUND for a deleted story and leaves it intact", async () => {
    const { id, updatedAt, doc } = await seed({ deletedAt: new Date() });

    expect(await saveStory(id, "Story", "New", "", updatedAt)).toMatchObject({
      ok: false,
      error: "NOT_FOUND",
    });
    expect(await load(id)).toEqual(doc);
  });

  it("returns NOT_FOUND for another user's story and leaves it intact", async () => {
    const { id, updatedAt, doc } = await seed({ userId: bob });

    expect(await saveStory(id, "Story", "New", "", updatedAt)).toMatchObject({
      ok: false,
      error: "NOT_FOUND",
    });
    expect(await load(id)).toEqual(doc);
  });

  it.each([new Types.ObjectId().toString(), "not-an-id"])(
    "returns NOT_FOUND for unknown id %s",
    async (id) => {
      expect(
        await saveStory(id, "Story", "New", "", new Date().toISOString()),
      ).toMatchObject({ error: "NOT_FOUND" });
    },
  );

  it("returns UNAUTHORIZED without a session and saves nothing", async () => {
    const { id, updatedAt, doc } = await seed();
    signInAs(null);

    expect(await saveStory(id, "Story", "New", "", updatedAt)).toEqual(
      unauthorized,
    );
    expect(await load(id)).toEqual(doc);
  });
});
