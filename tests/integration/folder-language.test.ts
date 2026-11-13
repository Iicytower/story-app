import { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setFolderLanguage } from "@/app/[locale]/(protected)/books/actions";
import type { ActionError } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import { getEditorFolder, getFolder, listFolders } from "@/lib/folders/queries";
import { Folder } from "@/lib/models/folder";
import { setupTestDb } from "./test-db";

vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn() }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

setupTestDb();

const alice = new Types.ObjectId();
const bob = new Types.ObjectId();
const OLD = new Date("2026-01-01T00:00:00.000Z");

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

// As written by deployments before task 29: no language field at all.
async function seedOldFolder(userId = alice) {
  const { insertedId } = await Folder.collection.insertOne({
    userId,
    name: `Old ${new Types.ObjectId()}`,
    notes: "",
    notesUpdatedAt: OLD,
    lastActivityAt: OLD,
    chapterSort: "created",
    manualChapterOrder: false,
    deletedAt: null,
    createdAt: OLD,
    updatedAt: OLD,
  });
  return insertedId.toString();
}

describe("folder language", () => {
  it("is Polish for a folder without one, in every query", async () => {
    const id = await seedOldFolder();
    expect((await getFolder(alice.toString(), id))?.language).toBe("pl");
    expect((await getEditorFolder(alice.toString(), id))?.language).toBe("pl");
    const { folders } = await listFolders(alice.toString());
    expect(folders.map(({ language }) => language)).toEqual(["pl"]);
    expect(
      await Folder.collection.findOne({ _id: new Types.ObjectId(id) }),
    ).not.toHaveProperty("language");
  });

  it("new folders store no language until one is picked", async () => {
    const folder = await Folder.create({ userId: alice, name: "New" });
    expect(
      await Folder.collection.findOne({ _id: folder._id }),
    ).not.toHaveProperty("language");
  });

  it("stores the picked language without touching the folder's dates", async () => {
    const id = await seedOldFolder();
    expect(await setFolderLanguage(id, "pl")).toEqual({ ok: true });
    const stored = await Folder.collection.findOne({
      _id: new Types.ObjectId(id),
    });
    expect(stored).toMatchObject({ language: "pl", updatedAt: OLD });
    expect((await getEditorFolder(alice.toString(), id))?.language).toBe("pl");
  });

  it("rejects a language that is not on the list", async () => {
    const id = await seedOldFolder();
    expect(await setFolderLanguage(id, "en")).toMatchObject({
      ok: false,
      error: "INVALID_INPUT",
    });
    expect(
      await Folder.collection.findOne({ _id: new Types.ObjectId(id) }),
    ).not.toHaveProperty("language");
  });

  it("gives NOT_FOUND for another user's or a deleted folder", async () => {
    const foreign = await seedOldFolder(bob);
    expect(await setFolderLanguage(foreign, "pl")).toMatchObject({
      ok: false,
      error: "NOT_FOUND",
    });
    expect(
      await Folder.collection.findOne({ _id: new Types.ObjectId(foreign) }),
    ).not.toHaveProperty("language");

    const deleted = await seedOldFolder();
    await Folder.updateOne({ _id: deleted }, { deletedAt: new Date() });
    expect(await setFolderLanguage(deleted, "pl")).toMatchObject({
      error: "NOT_FOUND",
    });
    expect(await setFolderLanguage("not-an-id", "pl")).toMatchObject({
      error: "NOT_FOUND",
    });
  });

  it("refuses without a session", async () => {
    const id = await seedOldFolder();
    signInAs(null);
    expect(await setFolderLanguage(id, "pl")).toEqual(unauthorized);
  });
});
