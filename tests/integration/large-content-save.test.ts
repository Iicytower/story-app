import { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveFolderNotes } from "@/app/[locale]/(protected)/folders/actions";
import {
  importStories,
  saveStory,
} from "@/app/[locale]/(protected)/stories/actions";
import { requireUser } from "@/lib/auth/session";
import { MAX_CONTENT_LENGTH, MAX_NOTES_LENGTH } from "@/lib/limits";
import { Folder } from "@/lib/models/folder";
import { Story } from "@/lib/models/story";
import { setupTestDb } from "./test-db";

vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn() }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

setupTestDb();

const alice = new Types.ObjectId();
// Two bytes per character in UTF-8: the limit counts characters (D72).
const text = (length: number) => "ż".repeat(length);

let folderId: string;
let storyId: string;

beforeEach(async () => {
  vi.mocked(requireUser).mockResolvedValue({
    ok: true,
    userId: alice.toString(),
  });
  const folder = await Folder.create({ userId: alice, name: "Book" });
  folderId = folder._id.toString();
  storyId = (
    await Story.create({ userId: alice, folderId, title: "One" })
  )._id.toString();
});

const story = () => Story.findById(storyId).lean();
const folder = () => Folder.findById(folderId).lean();

describe("saving long text (F8)", () => {
  it("saves content and notes just below the limit, whole", async () => {
    const result = await saveStory(
      storyId,
      "One",
      text(MAX_CONTENT_LENGTH),
      text(MAX_NOTES_LENGTH),
      (await story())!.updatedAt.toISOString(),
    );
    expect(result).toMatchObject({ ok: true });
    expect((await story())!.content).toBe(text(MAX_CONTENT_LENGTH));
    expect((await story())!.notes).toBe(text(MAX_NOTES_LENGTH));
  });

  it.each([
    ["content", text(MAX_CONTENT_LENGTH + 1), ""],
    ["notes", "", text(MAX_NOTES_LENGTH + 1)],
  ])("rejects %s just above the limit", async (_, content, notes) => {
    const result = await saveStory(
      storyId,
      "One",
      content,
      notes,
      (await story())!.updatedAt.toISOString(),
    );
    expect(result).toMatchObject({ ok: false, error: "INVALID_INPUT" });
    expect((await story())!.content).toBe("");
  });

  it("folder notes just below and just above the limit", async () => {
    const at = (await folder())!.notesUpdatedAt.toISOString();
    expect(
      await saveFolderNotes(folderId, text(MAX_NOTES_LENGTH + 1), at),
    ).toMatchObject({ ok: false, error: "INVALID_INPUT" });
    expect(
      await saveFolderNotes(folderId, text(MAX_NOTES_LENGTH), at),
    ).toMatchObject({ ok: true });
    expect((await folder())!.notes).toBe(text(MAX_NOTES_LENGTH));
  });

  it("import takes a chapter as long as the editor can save", async () => {
    const result = await importStories(
      { kind: "folder", id: folderId },
      [{ title: "Two", content: text(MAX_CONTENT_LENGTH), notes: "" }],
      "",
    );
    expect(result).toMatchObject({ ok: true });
    expect(
      (await Story.findOne({ title: "Two" }).lean())!.content,
    ).toHaveLength(MAX_CONTENT_LENGTH);
  });
});
