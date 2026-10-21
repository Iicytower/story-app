import { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveSettings } from "@/app/(protected)/actions";
import { requireUser } from "@/lib/auth/session";
import { DEFAULT_LAYOUT } from "@/lib/editor-layout";
import { Settings } from "@/lib/models/settings";
import { User } from "@/lib/models/user";
import { getUserSettings, updateUserSettings } from "@/lib/settings/queries";
import { DEFAULT_SETTINGS } from "@/lib/settings/settings";
import { setupTestDb } from "./test-db";

vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn() }));
vi.mock("@/auth", () => ({ signOut: vi.fn() }));

setupTestDb();

let alice: Types.ObjectId;
let bob: Types.ObjectId;

function signInAs(userId: Types.ObjectId) {
  vi.mocked(requireUser).mockResolvedValue({
    ok: true,
    userId: userId.toString(),
  });
}

beforeEach(async () => {
  [alice, bob] = (
    await User.create([
      { email: "alice@example.com", passwordHash: "x" },
      { email: "bob@example.com", passwordHash: "x" },
    ])
  ).map((user) => user._id);
  signInAs(alice);
});

const layout = { ...DEFAULT_LAYOUT, split: true, tab: "chapters" as const };
const stored = (userId: Types.ObjectId) => Settings.findOne({ userId }).lean();

describe("saveSettings", () => {
  it("returns the defaults for a user who never changed anything", async () => {
    expect(await getUserSettings(alice.toString())).toEqual(DEFAULT_SETTINGS);
    expect(await Settings.countDocuments()).toBe(0);
  });

  it("keeps the settings in their own collection, one document per user", async () => {
    await saveSettings({ appearance: { theme: "dark" } });
    await saveSettings({ editor: { mobileView: "notes" } });

    expect(await Settings.find().lean()).toEqual([
      expect.objectContaining({
        userId: alice,
        appearance: { theme: "dark" },
        editor: { mobileView: "notes" },
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      }),
    ]);
    expect(await User.findById(alice).lean()).not.toHaveProperty("appearance");
  });

  it("saves each field without touching the others", async () => {
    expect(await saveSettings({ editor: { layout } })).toEqual({ ok: true });
    expect(await saveSettings({ appearance: { theme: "dark" } })).toEqual({
      ok: true,
    });
    expect(await saveSettings({ editor: { mobileView: "notes" } })).toEqual({
      ok: true,
    });

    expect(await getUserSettings(alice.toString())).toEqual({
      ...DEFAULT_SETTINGS,
      editor: { layout, mobileView: "notes" },
      appearance: { theme: "dark" },
    });
  });

  it("creates one document when the first saves run in parallel", async () => {
    const results = await Promise.all([
      saveSettings({ editor: { layout } }),
      saveSettings({ appearance: { theme: "dark" } }),
      updateUserSettings(alice.toString(), { folders: { sort: "alpha" } }),
    ]);

    expect(results.slice(0, 2)).toEqual([{ ok: true }, { ok: true }]);
    expect(await Settings.countDocuments({ userId: alice })).toBe(1);
    expect(await getUserSettings(alice.toString())).toMatchObject({
      editor: { layout },
      appearance: { theme: "dark" },
      folders: { sort: "alpha" },
    });
  });

  it("changes only the signed-in user's settings", async () => {
    await saveSettings({ appearance: { theme: "dark" }, editor: { layout } });

    expect(await getUserSettings(bob.toString())).toEqual(DEFAULT_SETTINGS);
  });

  it("rejects invalid input and folder settings, and stores a normalized layout", async () => {
    for (const patch of [
      { appearance: { theme: "blue" } },
      { folders: { manualOrder: true } },
      "dark",
    ]) {
      expect(await saveSettings(patch)).toMatchObject({
        ok: false,
        error: "INVALID_INPUT",
      });
    }
    expect(await stored(alice)).toBeNull();

    await saveSettings({
      editor: { layout: { split: true, widths: { x: 1 } } },
    });
    expect((await stored(alice))?.editor).toEqual({
      layout: { ...DEFAULT_LAYOUT, split: true },
    });
  });

  it("falls back to defaults for broken stored settings", async () => {
    await Settings.collection.insertOne({
      userId: alice,
      appearance: { theme: 7 },
      editor: { layout: "wide", mobileView: "x" },
      folders: "alpha",
    });
    expect(await getUserSettings(alice.toString())).toEqual(DEFAULT_SETTINGS);
  });

  it("requires a session", async () => {
    vi.mocked(requireUser).mockResolvedValue({
      ok: false,
      error: "UNAUTHORIZED",
      message: "Your session has expired. Please sign in again.",
    });
    expect(await saveSettings({ appearance: { theme: "dark" } })).toMatchObject(
      {
        ok: false,
        error: "UNAUTHORIZED",
      },
    );
    expect(await Settings.countDocuments()).toBe(0);
  });
});
