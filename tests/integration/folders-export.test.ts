import { unzipSync } from "fflate";
import { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/(protected)/folders/[id]/export/route";
import { deleteFolder } from "@/app/(protected)/folders/actions";
import { requireUser } from "@/lib/auth/session";
import { getFolderForExport } from "@/lib/folders/queries";
import { Folder } from "@/lib/models/folder";
import { Story } from "@/lib/models/story";
import { setupTestDb } from "./test-db";

vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn() }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

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

const day = (n: number) => new Date(Date.UTC(2026, 0, n));

// Chapters "First", "Second", "Third" created in that order, so newest first is reversed.
async function seedFolder(userId = alice) {
  const folder = await Folder.create({
    userId,
    name: "Book",
    notes: "secret folder note",
  });
  const ids: Types.ObjectId[] = [];
  for (const [index, title] of ["First", "Second", "Third"].entries()) {
    const { _id } = await Story.create({
      userId,
      folderId: folder._id,
      title,
      content: `${title} text <!-- hidden -->`,
      notes: "secret chapter note",
      position: index,
    });
    await Story.collection.updateOne(
      { _id },
      { $set: { createdAt: day(index + 1) } },
    );
    ids.push(_id);
  }
  return { folderId: folder._id.toString(), ids };
}

describe("GET /folders/[id]/export", () => {
  const exportFolder = (id: string) =>
    GET(new Request(`http://localhost/folders/${id}/export`), {
      params: Promise.resolve({ id }),
    });

  it("returns a zip with numbered chapters in the folder order and notes.md", async () => {
    const { folderId } = await seedFolder();
    const response = await exportFolder(folderId);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/zip");
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="book.zip"',
    );
    const files = unzipSync(new Uint8Array(await response.arrayBuffer()));
    expect(Object.keys(files)).toEqual([
      "01-third.md",
      "02-second.md",
      "03-first.md",
      "notes.md",
    ]);
  });

  it("returns 401 without a session and 404 for another user's or a deleted folder", async () => {
    const { folderId } = await seedFolder();
    const bobs = await seedFolder(bob);

    signInAs(null);
    expect((await exportFolder(folderId)).status).toBe(401);

    signInAs(alice);
    expect((await exportFolder(bobs.folderId)).status).toBe(404);
    expect((await exportFolder("not-an-id")).status).toBe(404);
    await deleteFolder(folderId);
    expect((await exportFolder(folderId)).status).toBe(404);
    expect(await getFolderForExport(alice.toString(), folderId)).toBeNull();
  });
});
