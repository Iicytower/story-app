import { Types } from "mongoose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getAvatar } from "@/app/avatars/[id]/route";
import { setFolderCover } from "@/app/[locale]/(protected)/books/[id]/cover-actions";
import {
  getMyProfile,
  removeAvatar,
  uploadAvatar,
} from "@/app/[locale]/(protected)/profile/actions";
import { requireUser } from "@/lib/auth/session";
import { classifyCover } from "@/lib/covers/classify";
import { AVATAR_SIZE } from "@/lib/covers/covers";
import { storedImageBytes } from "@/lib/covers/queries";
import { Avatar } from "@/lib/models/avatar";
import { Cover } from "@/lib/models/cover";
import { Folder } from "@/lib/models/folder";
import { Profile } from "@/lib/models/profile";
import { User } from "@/lib/models/user";
import { getPublicProfile } from "@/lib/profiles/queries";
import { SOCIAL_LIMITS } from "@/lib/rate-limit";
import { ToolsError } from "@/lib/tools/client";
import en from "@/messages/en.json";
import { setupTestDb } from "./test-db";

vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn() }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("@/lib/covers/classify", () => ({ classifyCover: vi.fn() }));

setupTestDb();

const MB = 1024 * 1024;
let alice: Types.ObjectId;
let bob: Types.ObjectId;

const webp = (marker: number, size = 64) => {
  const bytes = Buffer.alloc(size, marker);
  bytes.write("RIFF", 0, "ascii");
  bytes.write("WEBP", 8, "ascii");
  return bytes;
};
const UPLOAD = webp(1);
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

const form = (bytes: Buffer = UPLOAD, name = "avatar") => {
  const data = new FormData();
  data.set(name, new Blob([new Uint8Array(bytes)]));
  return data;
};

const serve = (id: string) =>
  getAvatar(new Request("http://localhost/avatars/x"), {
    params: Promise.resolve({ id }),
  });

const idOf = (path: string) => path.split("/").at(-1)!;

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
});

describe("uploadAvatar", () => {
  it("stores the square image re-encoded by the filter and shows it on the profile", async () => {
    const result = await uploadAvatar(form());
    expect(result).toEqual({ ok: true, avatar: expect.any(String) });
    if (!result.ok) return;
    expect(vi.mocked(classifyCover)).toHaveBeenCalledWith(
      { url: "http://tools.test", secret: "secret" },
      UPLOAD,
      AVATAR_SIZE,
    );
    const avatar = await Avatar.findById(idOf(result.avatar)).lean();
    expect(avatar).toMatchObject({
      userId: alice,
      size: RATED.length,
      scores: SAFE,
      model: "test-model",
    });
    expect(Buffer.from(avatar!.data.buffer)).toEqual(RATED);
    expect((await getPublicProfile("Alice", null))?.avatar).toBe(result.avatar);
    expect(await getMyProfile()).toMatchObject({ avatar: result.avatar });

    const response = await serve(idOf(result.avatar));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/webp");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=31536000, immutable",
    );
    expect(Buffer.from(await response.arrayBuffer())).toEqual(RATED);
  });

  it("refuses an image rated 18+ and stores nothing", async () => {
    classifierRates(ADULT);
    expect(await uploadAvatar(form())).toEqual({
      ok: false,
      error: "INVALID_INPUT",
      message: en.errors.avatarAdult,
    });
    expect(await Avatar.countDocuments()).toBe(0);
    expect((await getPublicProfile("Alice", null))?.avatar).toBeNull();
  });

  it("removes the stored image when the profile cannot be saved", async () => {
    const save = vi
      .spyOn(Profile, "findOneAndUpdate")
      .mockImplementation(() => {
        throw new Error("write failed");
      });
    try {
      expect(await uploadAvatar(form())).toEqual({
        ok: false,
        error: "CONFLICT",
        message: en.errors.requestInvalid,
      });
    } finally {
      save.mockRestore();
    }
    expect(await Avatar.countDocuments()).toBe(0);
  });

  it("keeps the previous avatar when the filter refuses or fails", async () => {
    const first = await uploadAvatar(form());
    classifierRates(ADULT);
    await uploadAvatar(form());
    vi.mocked(classifyCover).mockRejectedValue(new ToolsError("TIMEOUT"));
    expect(await uploadAvatar(form())).toEqual({
      ok: false,
      error: "TOOL_UNAVAILABLE",
      message: en.errors.toolUnavailable,
    });
    expect(await Avatar.countDocuments()).toBe(1);
    expect(first.ok && (await getPublicProfile("Alice", null))?.avatar).toBe(
      first.ok && first.avatar,
    );
  });

  it("is unavailable without the tools server, with no classifier call", async () => {
    delete process.env.TOOLS_API_URL;
    expect(await uploadAvatar(form())).toEqual({
      ok: false,
      error: "TOOL_UNAVAILABLE",
      message: en.errors.avatarsUnavailable,
    });
    expect(vi.mocked(classifyCover)).not.toHaveBeenCalled();
  });

  it("rejects what is not a WebP, JPEG or PNG image", async () => {
    for (const bad of [form(Buffer.from("<svg/>")), form(UPLOAD, "other")]) {
      expect(await uploadAvatar(bad)).toEqual({
        ok: false,
        error: "INVALID_INPUT",
        message: en.errors.avatarInvalid,
      });
    }
    expect(await uploadAvatar(form(webp(1, 2 * MB)))).toEqual({
      ok: false,
      error: "TOO_LARGE",
      message: en.errors.avatarTooLarge,
    });
    expect(vi.mocked(classifyCover)).not.toHaveBeenCalled();
  });

  it("replaces the previous avatar, whose address stops working", async () => {
    const first = await uploadAvatar(form());
    classifierRates(SAFE, webp(3));
    const second = await uploadAvatar(form());
    if (!first.ok || !second.ok) throw new Error("upload failed");
    expect(second.avatar).not.toBe(first.avatar);
    expect(await Avatar.countDocuments()).toBe(1);
    expect((await serve(idOf(first.avatar))).status).toBe(404);
    expect((await serve(idOf(second.avatar))).status).toBe(200);
  });

  it("counts uploads per account", async () => {
    // A new account gets half of the daily limit (D80).
    const max = Math.floor(SOCIAL_LIMITS.avatarDay.max / 2);
    for (let index = 0; index < max; index++) {
      expect(await uploadAvatar(form())).toMatchObject({ ok: true });
    }
    expect(await uploadAvatar(form())).toEqual({
      ok: false,
      error: "RATE_LIMITED",
      message: en.errors.tooManyAttempts,
    });
    signInAs(bob);
    expect(await uploadAvatar(form())).toMatchObject({ ok: true });
  });

  it("requires a session", async () => {
    signInAs(null);
    expect(await uploadAvatar(form())).toMatchObject({
      ok: false,
      error: "UNAUTHORIZED",
    });
    expect(await removeAvatar()).toMatchObject({ error: "UNAUTHORIZED" });
  });
});

describe("removeAvatar", () => {
  it("removes only the session user's avatar", async () => {
    const own = await uploadAvatar(form());
    signInAs(bob);
    const bobs = await uploadAvatar(form());
    if (!own.ok || !bobs.ok) throw new Error("upload failed");
    expect(await removeAvatar()).toEqual({ ok: true });
    expect((await serve(idOf(bobs.avatar))).status).toBe(404);
    expect((await serve(idOf(own.avatar))).status).toBe(200);
    expect((await getPublicProfile("Bob", null))?.avatar).toBeNull();
    expect(await Avatar.countDocuments({ userId: bob })).toBe(0);
    expect(await removeAvatar()).toEqual({ ok: true });
  });
});

describe("GET /avatars/[id]", () => {
  it("serves no image that is not a profile's current avatar", async () => {
    const stray = await Avatar.create({
      userId: alice,
      data: RATED,
      size: RATED.length,
      scores: SAFE,
      model: "m",
    });
    await Profile.create({ userId: bob, avatarId: stray._id });
    expect((await serve(stray._id.toString())).status).toBe(404);
    expect((await serve("nope")).status).toBe(404);
    expect((await serve(new Types.ObjectId().toString())).status).toBe(404);
  });
});

describe("the limit for all images", () => {
  it("counts covers and avatars together", async () => {
    process.env.COVERS_MAX_TOTAL_MB = "1";
    const folder = await Folder.create({ userId: bob, name: "Book" });
    await Cover.create({
      userId: bob,
      folderId: folder._id,
      data: Buffer.from("x"),
      size: MB - 10,
      state: "rated",
    });
    expect(await storedImageBytes()).toBe(MB - 10);
    expect(await uploadAvatar(form())).toEqual({
      ok: false,
      error: "TOO_LARGE",
      message: en.errors.avatarLimitTotal,
    });

    await Cover.deleteMany({});
    await Avatar.create({
      userId: bob,
      data: Buffer.from("x"),
      size: MB - 10,
      scores: SAFE,
      model: "m",
    });
    const own = await Folder.create({ userId: alice, name: "Mine" });
    expect(
      await setFolderCover(own._id.toString(), form(UPLOAD, "cover")),
    ).toEqual({
      ok: false,
      error: "TOO_LARGE",
      message: en.errors.coverLimitTotal,
    });
  });

  it("lets an avatar be replaced when there is no room for a new one", async () => {
    const first = await uploadAvatar(form());
    expect(first.ok).toBe(true);
    process.env.COVERS_MAX_TOTAL_MB = String(RATED.length / MB);
    expect(await uploadAvatar(form())).toMatchObject({ ok: true });
  });
});
