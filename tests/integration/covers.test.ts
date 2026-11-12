import { Types } from "mongoose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getCover } from "@/app/covers/[id]/route";
import { GET as exportFolderZip } from "@/app/books/[id]/export/route";
import {
  dismissCoverRejection,
  removeFolderCover,
  setCoverAdult,
  setFolderCover,
} from "@/app/[locale]/(protected)/books/[id]/cover-actions";
import {
  deleteFolder,
  setFolderAdult,
  setFolderPublished,
} from "@/app/[locale]/(protected)/books/actions";
import { requireUser } from "@/lib/auth/session";
import { classifyCover } from "@/lib/covers/classify";
import { COVERS_PER_ACCOUNT } from "@/lib/covers/covers";
import { coverBytes, retryDueCovers } from "@/lib/covers/mutations";
import { getFolder, listFolders } from "@/lib/folders/queries";
import {
  getPublishedChapter,
  getPublishedFolder,
  listRecentlyPublished,
  searchPublishedChapters,
} from "@/lib/publish/queries";
import { unzip } from "@/lib/import/files";
import { Cover } from "@/lib/models/cover";
import { Folder } from "@/lib/models/folder";
import { Story } from "@/lib/models/story";
import { User } from "@/lib/models/user";
import { ToolsError } from "@/lib/tools/client";
import { setupTestDb } from "./test-db";

vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn() }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("@/lib/covers/classify", () => ({ classifyCover: vi.fn() }));

setupTestDb();

const OLD = new Date("2026-01-01T00:00:00.000Z");
const MINUTE = 60_000;
let alice: Types.ObjectId;
let bob: Types.ObjectId;

const webp = (marker: number, size = 64) => {
  const bytes = Buffer.alloc(size, marker);
  bytes.write("RIFF", 0, "ascii");
  bytes.write("WEBP", 8, "ascii");
  return bytes;
};
const UPLOAD = webp(1);
// What the filter sends back: re-encoded, so different from the upload.
const RATED = webp(2);
const SAFE = { nsfl: 0.01, nsfw: 0.02, sfw: 0.97 };
const ADULT = { nsfl: 0.01, nsfw: 0.9, sfw: 0.09 };

function signInAs(userId: Types.ObjectId | null) {
  vi.mocked(requireUser).mockResolvedValue(
    userId
      ? { ok: true, userId: userId.toString() }
      : { ok: false, error: "UNAUTHORIZED", message: "Signed out" },
  );
}

function classifierRates(scores = SAFE, image = RATED) {
  vi.mocked(classifyCover).mockResolvedValue({
    model: "test-model",
    scores,
    image,
  });
}

function classifierDown() {
  vi.mocked(classifyCover).mockRejectedValue(new ToolsError("UNAVAILABLE"));
}

const form = (bytes: Buffer = UPLOAD) => {
  const data = new FormData();
  data.set("cover", new Blob([new Uint8Array(bytes)]));
  return data;
};

beforeEach(async () => {
  process.env.TOOLS_API_URL = "http://tools.test";
  process.env.TOOLS_API_SECRET = "secret";
  vi.mocked(classifyCover).mockReset();
  classifierRates();
  alice = (await User.create({ nickname: "Alice", passwordHash: "x" }))._id;
  bob = (await User.create({ nickname: "Bob", passwordHash: "x" }))._id;
  signInAs(alice);
});

afterEach(() => {
  delete process.env.TOOLS_API_URL;
  delete process.env.TOOLS_API_SECRET;
  delete process.env.COVERS_MAX_TOTAL_MB;
  vi.useRealTimers();
});

async function seedFolder(userId = alice, name = "Księga") {
  const folder = await Folder.create({ userId, name, lastActivityAt: OLD });
  await Folder.collection.updateOne(
    { _id: folder._id },
    { $set: { updatedAt: OLD } },
  );
  const story = await Story.create({
    userId,
    folderId: folder._id,
    title: "One",
    content: "text",
  });
  await Story.collection.updateOne(
    { _id: story._id },
    { $set: { updatedAt: OLD } },
  );
  return { id: folder._id.toString(), storyId: story._id.toString() };
}

const folderDoc = (id: string) => Folder.findById(id).lean();
const coversOf = (id: string) =>
  Cover.find({ folderId: id }).sort({ _id: 1 }).lean();
const request = () => new Request("http://localhost/covers/x");
const serve = (id: string) =>
  getCover(request(), { params: Promise.resolve({ id }) });

describe("setFolderCover", () => {
  it("stores the image re-encoded by the filter and shows it on the folder", async () => {
    const { id, storyId } = await seedFolder();
    expect(await setFolderCover(id, form())).toEqual({
      ok: true,
      state: "rated",
      adult: false,
    });

    const [cover] = await coversOf(id);
    expect(cover).toMatchObject({
      state: "rated",
      size: RATED.length,
      scores: SAFE,
      model: "test-model",
      autoAdult: false,
      userId: alice,
    });
    expect(coverBytes(cover.data)).toEqual(RATED);
    expect(vi.mocked(classifyCover).mock.calls[0][1]).toEqual(UPLOAD);
    const folder = (await folderDoc(id))!;
    expect(folder.coverId).toEqual(cover._id);
    expect((await getFolder(alice.toString(), id))!.cover).toEqual({
      id: cover._id.toString(),
      path: `/covers/${cover._id}`,
      manualAdult: false,
      autoAdult: false,
      adminAdult: null,
    });
    // Organizational change: neither the folder nor its chapters move.
    expect(folder.updatedAt).toEqual(OLD);
    expect(folder.lastActivityAt).toEqual(OLD);
    expect((await Story.findById(storyId).lean())!.updatedAt).toEqual(OLD);
  });

  it("rejects bytes that are no image or too large, keeping the old cover", async () => {
    const { id } = await seedFolder();
    await setFolderCover(id, form());
    const before = await coversOf(id);

    expect(
      await setFolderCover(id, form(Buffer.from("<svg></svg>"))),
    ).toMatchObject({ ok: false, error: "INVALID_INPUT" });
    expect(
      await setFolderCover(id, form(webp(3, 1024 * 1024 + 1))),
    ).toMatchObject({ ok: false, error: "TOO_LARGE" });
    expect(await setFolderCover(id, new FormData())).toMatchObject({
      ok: false,
      error: "INVALID_INPUT",
    });
    expect(await coversOf(id)).toEqual(before);
  });

  it("replacing and removing delete the old image", async () => {
    const { id } = await seedFolder();
    await setFolderCover(id, form());
    const [first] = await coversOf(id);
    await setFolderCover(id, form(webp(4)));
    const covers = await coversOf(id);
    expect(covers).toHaveLength(1);
    expect(covers[0]._id).not.toEqual(first._id);
    expect((await folderDoc(id))!.coverId).toEqual(covers[0]._id);

    expect(await removeFolderCover(id)).toEqual({ ok: true });
    expect(await coversOf(id)).toEqual([]);
    expect((await folderDoc(id))!.coverId).toBeUndefined();
  });

  it("gives NOT_FOUND for another user's folder", async () => {
    const { id } = await seedFolder(bob);
    expect(await setFolderCover(id, form())).toMatchObject({
      ok: false,
      error: "NOT_FOUND",
    });
    expect(await removeFolderCover(id)).toMatchObject({ error: "NOT_FOUND" });
    expect(await setCoverAdult(id, true)).toMatchObject({ error: "NOT_FOUND" });
    expect(await coversOf(id)).toEqual([]);
  });

  it("is unavailable without TOOLS_API_URL and calls no classifier", async () => {
    delete process.env.TOOLS_API_URL;
    const { id } = await seedFolder();
    expect(await setFolderCover(id, form())).toMatchObject({
      ok: false,
      error: "TOOL_UNAVAILABLE",
    });
    expect(classifyCover).not.toHaveBeenCalled();
    expect(await retryDueCovers()).toEqual([]);
    expect(await coversOf(id)).toEqual([]);
  });

  it("removes the cover with the folder", async () => {
    const { id } = await seedFolder();
    await setFolderCover(id, form());
    await deleteFolder(id);
    expect(await coversOf(id)).toEqual([]);
  });
});

describe("without a verdict", () => {
  it("keeps the upload pending and unserved, and the old cover stays", async () => {
    const { id } = await seedFolder();
    await setFolderCover(id, form());
    const [old] = await coversOf(id);
    classifierDown();

    expect(await setFolderCover(id, form(webp(5)))).toEqual({
      ok: true,
      state: "pending",
      adult: false,
    });
    const covers = await coversOf(id);
    expect(covers.map(({ state }) => state)).toEqual(["rated", "pending"]);
    expect((await folderDoc(id))!.coverId).toEqual(old._id);
    expect((await serve(covers[1]._id.toString())).status).toBe(404);
    expect((await serve(old._id.toString())).status).toBe(200);
    expect((await getFolder(alice.toString(), id))!.coverPending).toBe(true);
  });

  it("retries 5 min, 30 min and 24 h after the upload, then drops the cover", async () => {
    const { id } = await seedFolder();
    classifierDown();
    const start = new Date("2026-03-01T10:00:00.000Z");
    vi.useFakeTimers({ now: start, toFake: ["Date"] });
    await setFolderCover(id, form());
    const at = async (minutes: number) => {
      vi.setSystemTime(new Date(start.getTime() + minutes * MINUTE));
      return retryDueCovers();
    };

    expect(await at(4)).toEqual([]);
    expect(await at(5)).toEqual(["pending"]);
    expect(await at(29)).toEqual([]);
    expect(await at(30)).toEqual(["pending"]);
    expect(await at(24 * 60 - 1)).toEqual([]);
    expect(await at(24 * 60)).toEqual(["rejected"]);

    expect(classifyCover).toHaveBeenCalledTimes(4);
    expect(await coversOf(id)).toEqual([]);
    expect((await folderDoc(id))!.coverRejectedAt).toBeInstanceOf(Date);
    expect((await getFolder(alice.toString(), id))!.coverRejected).toBe(true);
    expect(await dismissCoverRejection(id)).toEqual({ ok: true });
    expect((await getFolder(alice.toString(), id))!.coverRejected).toBe(false);
  });

  it("shows the cover once a retry gets a verdict", async () => {
    const { id } = await seedFolder();
    classifierDown();
    await setFolderCover(id, form());
    await Cover.updateMany({}, { $set: { nextAttemptAt: new Date(0) } });
    classifierRates();

    expect(await retryDueCovers()).toEqual(["rated"]);
    const [cover] = await coversOf(id);
    expect(cover.state).toBe("rated");
    expect((await folderDoc(id))!.coverId).toEqual(cover._id);
  });

  it("a claimed cover is not tried twice at once", async () => {
    const { id } = await seedFolder();
    classifierDown();
    await setFolderCover(id, form());
    await Cover.updateMany({}, { $set: { nextAttemptAt: new Date(0) } });
    let release!: () => void;
    // The upload's own try counts as a call; only the retries matter here.
    vi.mocked(classifyCover).mockClear();
    vi.mocked(classifyCover).mockImplementation(
      () =>
        new Promise((_, reject) => {
          release = () => reject(new ToolsError("UNAVAILABLE"));
        }),
    );
    const first = retryDueCovers();
    await vi.waitFor(() => expect(classifyCover).toHaveBeenCalledTimes(1));
    expect(await retryDueCovers()).toEqual([]);
    release();
    expect(await first).toEqual(["pending"]);
  });
});

describe("18+ from the filter", () => {
  it("locks the folder's 18+ mark until the cover is replaced or removed", async () => {
    const { id } = await seedFolder();
    classifierRates(ADULT);
    expect(await setFolderCover(id, form())).toMatchObject({ adult: true });
    expect((await getFolder(alice.toString(), id))!.adult).toEqual({
      adult: true,
      lock: "auto",
    });
    expect(await setFolderAdult(id, false)).toMatchObject({
      error: "ADULT_LOCKED",
    });

    classifierRates(SAFE);
    await setFolderCover(id, form(webp(6)));
    expect((await getFolder(alice.toString(), id))!.adult).toEqual({
      adult: false,
      lock: null,
    });

    classifierRates(ADULT);
    await setFolderCover(id, form(webp(7)));
    await setFolderAdult(id, true);
    await removeFolderCover(id);
    // The owner's own mark outlives the cover.
    expect((await getFolder(alice.toString(), id))!.adult).toEqual({
      adult: true,
      lock: null,
    });
  });

  it("uses the threshold from COVERS_ADULT_THRESHOLD", async () => {
    process.env.COVERS_ADULT_THRESHOLD = "0.95";
    const { id } = await seedFolder();
    classifierRates(ADULT);
    expect(await setFolderCover(id, form())).toMatchObject({ adult: false });
    delete process.env.COVERS_ADULT_THRESHOLD;
  });

  it("the owner's own cover mark does not lock the folder", async () => {
    const { id } = await seedFolder();
    await setFolderCover(id, form());
    expect(await setCoverAdult(id, true)).toEqual({ ok: true });
    expect((await getFolder(alice.toString(), id))!.cover).toMatchObject({
      manualAdult: true,
      autoAdult: false,
    });
    expect((await getFolder(alice.toString(), id))!.adult.lock).toBeNull();
  });
});

describe("limits", () => {
  it(`allows ${COVERS_PER_ACCOUNT} covers per account; replacing still works`, async () => {
    const ids = [];
    for (let index = 0; index <= COVERS_PER_ACCOUNT; index++) {
      ids.push((await seedFolder(alice, `F${index}`)).id);
    }
    for (const id of ids.slice(0, COVERS_PER_ACCOUNT)) {
      expect(await setFolderCover(id, form())).toMatchObject({ ok: true });
    }
    expect(await setFolderCover(ids.at(-1)!, form())).toMatchObject({
      ok: false,
      error: "TOO_LARGE",
    });
    expect(await coversOf(ids.at(-1)!)).toEqual([]);
    expect(await setFolderCover(ids[0], form(webp(8)))).toMatchObject({
      ok: true,
    });
  });

  it("stops new covers at the global size limit", async () => {
    process.env.COVERS_MAX_TOTAL_MB = String(100 / (1024 * 1024));
    const first = await seedFolder(bob, "Bob's");
    signInAs(bob);
    await setFolderCover(first.id, form());
    signInAs(alice);
    const { id } = await seedFolder();
    expect(await setFolderCover(id, form())).toMatchObject({
      ok: false,
      error: "TOO_LARGE",
    });
    signInAs(bob);
    expect(await setFolderCover(first.id, form(webp(9)))).toMatchObject({
      ok: true,
    });
  });
});

describe("GET /covers/[id]", () => {
  it("serves the owner privately and readers of a published folder publicly", async () => {
    const { id } = await seedFolder();
    await setFolderCover(id, form());
    const coverId = (await folderDoc(id))!.coverId!.toString();

    const own = await serve(coverId);
    expect(own.status).toBe(200);
    expect(own.headers.get("Content-Type")).toBe("image/webp");
    expect(own.headers.get("Cache-Control")).toBe(
      "private, max-age=31536000, immutable",
    );
    expect(Buffer.from(await own.arrayBuffer())).toEqual(RATED);

    signInAs(null);
    expect((await serve(coverId)).status).toBe(404);
    signInAs(bob);
    expect((await serve(coverId)).status).toBe(404);

    signInAs(alice);
    await setFolderPublished(id, true);
    signInAs(null);
    const published = await serve(coverId);
    expect(published.status).toBe(200);
    expect(published.headers.get("Cache-Control")).toBe(
      "public, max-age=31536000, immutable",
    );
  });

  it("does not serve a replaced cover or a malformed id", async () => {
    const { id } = await seedFolder();
    await setFolderCover(id, form());
    const old = (await folderDoc(id))!.coverId!.toString();
    await setFolderCover(id, form(webp(10)));
    expect((await serve(old)).status).toBe(404);
    expect((await serve("nope")).status).toBe(404);
  });
});

describe("export", () => {
  it("puts cover.webp into the folder zip", async () => {
    const { id } = await seedFolder();
    await setFolderCover(id, form());
    const response = await exportFolderZip(request(), {
      params: Promise.resolve({ id }),
    });
    const files = unzip(new Uint8Array(await response.arrayBuffer()));
    expect(Buffer.from(files["cover.webp"])).toEqual(RATED);
  });
});

describe("cover views", () => {
  it("lists the cover path of each folder, and none without a cover", async () => {
    const { id } = await seedFolder();
    await seedFolder(alice, "Bez okładki");
    await setFolderCover(id, form());
    const coverId = (await folderDoc(id))!.coverId!.toString();
    const { folders } = await listFolders(alice.toString());
    expect(
      Object.fromEntries(folders.map(({ name, cover }) => [name, cover])),
    ).toEqual({
      Księga: { path: `/covers/${coverId}`, adult: false },
      "Bez okładki": null,
    });
  });

  it("gives public pages the cover and whether it is 18+", async () => {
    const { id } = await seedFolder();
    await setFolderPublished(id, true);
    classifierRates(ADULT);
    await setFolderCover(id, form());
    const path = `/covers/${(await folderDoc(id))!.coverId}`;
    const cover = { path, adult: true };
    expect(await getPublishedFolder("Alice", "ksiega")).toMatchObject({
      cover,
    });
    expect(await getPublishedChapter("Alice", "ksiega", "one")).toMatchObject({
      cover,
    });
    expect(await searchPublishedChapters("text", [])).toMatchObject([
      { cover },
    ]);
    expect(await listRecentlyPublished()).toMatchObject([{ cover }]);
  });

  it("treats the owner's own cover mark as 18+ in public", async () => {
    const { id } = await seedFolder();
    await setFolderPublished(id, true);
    await setFolderCover(id, form());
    await setCoverAdult(id, true);
    expect((await getPublishedFolder("Alice", "ksiega"))!.cover).toMatchObject({
      adult: true,
    });
  });
});
