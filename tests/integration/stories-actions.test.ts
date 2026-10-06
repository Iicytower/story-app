import { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createStory, deleteStory } from "@/app/(protected)/stories/actions";
import type { ActionError } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import { Story } from "@/lib/models/story";
import { setupTestDb } from "./test-db";

vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

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

describe("createStory", () => {
  it("creates an empty story owned by the session user", async () => {
    const result = await createStory("My story");

    expect(result.ok).toBe(true);
    const id = result.ok ? result.id : "";
    const story = await Story.findById(id).lean();
    expect(story).toMatchObject({
      userId: alice,
      title: "My story",
      content: "",
      notes: "",
      deletedAt: null,
    });
  });

  it("trims the title", async () => {
    const result = await createStory("  Padded  ");

    const story = await Story.findById(result.ok ? result.id : "").lean();
    expect(story?.title).toBe("Padded");
  });

  it.each(["", "   "])("rejects empty title %j", async (title) => {
    expect(await createStory(title)).toMatchObject({ error: "EMPTY_TITLE" });
    expect(await Story.countDocuments()).toBe(0);
  });

  it("rejects a duplicate title of the same user, case-sensitively", async () => {
    await createStory("Dragon");

    expect(await createStory("Dragon")).toMatchObject({
      ok: false,
      error: "DUPLICATE_TITLE",
    });
    expect(await createStory(" Dragon ")).toMatchObject({
      error: "DUPLICATE_TITLE",
    });
    expect(await createStory("dragon")).toMatchObject({ ok: true });
  });

  it("allows the title of a deleted story or of another user's story", async () => {
    const first = await createStory("Reused");
    await deleteStory(first.ok ? first.id : "");
    expect(await createStory("Reused")).toMatchObject({ ok: true });

    signInAs(bob);
    expect(await createStory("Reused")).toMatchObject({ ok: true });
  });

  it("returns UNAUTHORIZED without a session", async () => {
    signInAs(null);

    expect(await createStory("Title")).toEqual(unauthorized);
    expect(await Story.countDocuments()).toBe(0);
  });
});

describe("deleteStory", () => {
  async function seed(userId = alice) {
    const story = await Story.create({ userId, title: "To delete" });
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
