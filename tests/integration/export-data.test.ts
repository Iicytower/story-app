import { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getFolder } from "@/app/(protected)/folders/[id]/export/data/route";
import { GET as getStory } from "@/app/(protected)/stories/[id]/export/data/route";
import { requireUser } from "@/lib/auth/session";
import { Folder } from "@/lib/models/folder";
import { Story } from "@/lib/models/story";
import { setupTestDb } from "./test-db";

vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn() }));

setupTestDb();

const alice = new Types.ObjectId();
const bob = new Types.ObjectId();

function signInAs(userId: Types.ObjectId | null) {
  vi.mocked(requireUser).mockResolvedValue(
    userId
      ? { ok: true, userId: userId.toString() }
      : { ok: false, error: "UNAUTHORIZED", message: "Signed out" },
  );
}

beforeEach(() => signInAs(alice));

const storyData = (id: string) =>
  getStory(new Request("http://localhost/"), {
    params: Promise.resolve({ id }),
  });
const folderData = (id: string) =>
  getFolder(new Request("http://localhost/"), {
    params: Promise.resolve({ id }),
  });

async function seed() {
  const folder = await Folder.create({
    userId: alice,
    name: "Book",
    notes: "Folder notes",
    chapterSort: "manual",
  });
  const make = (title: string, position: number) =>
    Story.create({
      userId: alice,
      folderId: folder._id,
      title,
      content: `${title} text`,
      notes: `${title} notes`,
      position,
    });
  const second = await make("Second", 1);
  const first = await make("First", 0);
  return { folder, first, second };
}

describe("export data routes", () => {
  it("returns a story as a one-chapter source", async () => {
    const { first } = await seed();
    const response = await storyData(first._id.toString());
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({
      kind: "story",
      title: "First",
      notes: "",
      chapters: [
        { title: "First", content: "First text", notes: "First notes" },
      ],
    });
  });

  it("returns a folder with its chapters in folder order", async () => {
    const { folder } = await seed();
    const body = await (await folderData(folder._id.toString())).json();
    expect(body.kind).toBe("folder");
    expect(body.title).toBe("Book");
    expect(body.notes).toBe("Folder notes");
    expect(body.chapters.map((c: { title: string }) => c.title)).toEqual([
      "First",
      "Second",
    ]);
  });

  it("treats other users' data as missing", async () => {
    const { folder, first } = await seed();
    signInAs(bob);
    expect((await storyData(first._id.toString())).status).toBe(404);
    expect((await folderData(folder._id.toString())).status).toBe(404);
  });

  it("treats deleted data as missing", async () => {
    const { folder, first } = await seed();
    await Story.updateOne({ _id: first._id }, { deletedAt: new Date() });
    await Folder.updateOne({ _id: folder._id }, { deletedAt: new Date() });
    expect((await storyData(first._id.toString())).status).toBe(404);
    expect((await folderData(folder._id.toString())).status).toBe(404);
  });

  it("returns 401 without a session", async () => {
    const { folder, first } = await seed();
    signInAs(null);
    expect((await storyData(first._id.toString())).status).toBe(401);
    expect((await folderData(folder._id.toString())).status).toBe(401);
  });
});
