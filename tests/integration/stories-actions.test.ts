import { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createStory, deleteStory } from "@/app/(protected)/stories/actions";
import type { ActionError } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import { Folder } from "@/lib/models/folder";
import { Story } from "@/lib/models/story";
import { setupTestDb } from "./test-db";

vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn() }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

setupTestDb();

const folderId = new Types.ObjectId();

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

describe("createStory", () => {
  it("creates an empty story owned by the session user", async () => {
    const result = await createStory("My story", "Drafts");

    expect(result.ok).toBe(true);
    const id = result.ok ? result.id : "";
    const story = await Story.findById(id).lean();
    const folder = await Folder.findOne({ name: "Drafts" }).lean();
    expect(story).toMatchObject({
      userId: alice,
      folderId: folder?._id,
      title: "My story",
      content: "",
      notes: "",
      deletedAt: null,
    });
  });

  it("trims the title", async () => {
    const result = await createStory("  Padded  ", "Drafts");

    const story = await Story.findById(result.ok ? result.id : "").lean();
    expect(story?.title).toBe("Padded");
  });

  it.each(["", "   "])("rejects empty title %j", async (title) => {
    expect(await createStory(title, "Drafts")).toMatchObject({
      error: "EMPTY_TITLE",
    });
    expect(await Story.countDocuments()).toBe(0);
  });

  it("rejects a duplicate title of the same user, case-sensitively", async () => {
    await createStory("Dragon", "Drafts");

    expect(await createStory("Dragon", "Drafts")).toMatchObject({
      ok: false,
      error: "DUPLICATE_TITLE",
    });
    expect(await createStory(" Dragon ", "Drafts")).toMatchObject({
      error: "DUPLICATE_TITLE",
    });
    expect(await createStory("dragon", "Drafts")).toMatchObject({ ok: true });
  });

  it("allows the title of a deleted story or of another user's story", async () => {
    const first = await createStory("Reused", "Drafts");
    await deleteStory(first.ok ? first.id : "");
    expect(await createStory("Reused", "Drafts")).toMatchObject({ ok: true });

    signInAs(bob);
    expect(await createStory("Reused", "Drafts")).toMatchObject({ ok: true });
  });

  it("returns UNAUTHORIZED without a session", async () => {
    signInAs(null);

    expect(await createStory("Title", "Drafts")).toEqual(unauthorized);
    expect(await Story.countDocuments()).toBe(0);
    expect(await Folder.countDocuments()).toBe(0);
  });

  it("adds the story to an existing folder picked by its trimmed name", async () => {
    const folder = await Folder.create({ userId: alice, name: "Drafts" });

    const result = await createStory("Chapter", "  Drafts ");

    const story = await Story.findById(result.ok ? result.id : "").lean();
    expect(story?.folderId).toEqual(folder._id);
    expect(await Folder.countDocuments()).toBe(1);
  });

  it("creates the folder when the user has none with that name", async () => {
    await Folder.create({ userId: alice, name: "drafts" });
    await Folder.create({
      userId: alice,
      name: "Drafts",
      deletedAt: new Date(),
    });

    const result = await createStory("Chapter", "Drafts");

    const active = await Folder.find({ userId: alice, deletedAt: null }).lean();
    expect(active.map((f) => f.name).sort()).toEqual(["Drafts", "drafts"]);
    const story = await Story.findById(result.ok ? result.id : "").lean();
    expect(story?.folderId).toEqual(
      active.find((f) => f.name === "Drafts")?._id,
    );
  });

  it("allows the same title in two folders", async () => {
    expect(await createStory("Prologue", "Book 1")).toMatchObject({ ok: true });
    expect(await createStory("Prologue", "Book 2")).toMatchObject({ ok: true });
  });

  it("sets the folder's lastActivityAt", async () => {
    const folder = await Folder.create({
      userId: alice,
      name: "Drafts",
      lastActivityAt: new Date("2026-01-01"),
    });

    await createStory("Chapter", "Drafts");

    const after = await Folder.findById(folder._id).lean();
    expect(after!.lastActivityAt.getTime()).toBeGreaterThan(
      new Date("2026-01-01").getTime(),
    );
  });

  it.each(["", "   "])(
    "rejects an empty folder name %j and creates nothing",
    async (name) => {
      expect(await createStory("Chapter", name)).toMatchObject({
        error: "EMPTY_NAME",
      });
      expect(await Story.countDocuments()).toBe(0);
      expect(await Folder.countDocuments()).toBe(0);
    },
  );

  it("does not create the folder when the title is empty", async () => {
    await createStory("  ", "New folder");
    expect(await Folder.countDocuments()).toBe(0);
  });

  it("never uses another user's folder with the same name", async () => {
    const bobs = await Folder.create({ userId: bob, name: "Shared name" });

    const result = await createStory("Chapter", "Shared name");

    const story = await Story.findById(result.ok ? result.id : "").lean();
    expect(story?.folderId).not.toEqual(bobs._id);
    expect(await Story.countDocuments({ folderId: bobs._id })).toBe(0);
    expect(
      await Folder.countDocuments({ userId: alice, name: "Shared name" }),
    ).toBe(1);
  });
});

describe("deleteStory", () => {
  async function seed(userId = alice) {
    const story = await Story.create({ folderId, userId, title: "To delete" });
    return story._id.toString();
  }

  it("sets deletedAt and keeps the document", async () => {
    const id = await seed();

    expect(await deleteStory(id)).toEqual({ ok: true });
    const story = await Story.findById(id).lean();
    expect(story?.deletedAt).toBeInstanceOf(Date);
  });

  it("returns NOT_FOUND for an already deleted story", async () => {
    const id = await seed();
    await deleteStory(id);
    const { deletedAt } = (await Story.findById(id).lean())!;

    expect(await deleteStory(id)).toMatchObject({ error: "NOT_FOUND" });
    expect((await Story.findById(id).lean())?.deletedAt).toEqual(deletedAt);
  });

  it("returns NOT_FOUND for another user's story and leaves it intact", async () => {
    const id = await seed(bob);
    const before = await Story.findById(id).lean();

    expect(await deleteStory(id)).toMatchObject({ error: "NOT_FOUND" });
    expect(await Story.findById(id).lean()).toEqual(before);
  });

  it.each([new Types.ObjectId().toString(), "not-an-id"])(
    "returns NOT_FOUND for unknown id %s",
    async (id) => {
      expect(await deleteStory(id)).toMatchObject({ error: "NOT_FOUND" });
    },
  );

  it("returns UNAUTHORIZED without a session", async () => {
    const id = await seed();
    signInAs(null);

    expect(await deleteStory(id)).toEqual(unauthorized);
    expect((await Story.findById(id).lean())?.deletedAt).toBeNull();
  });
});
