import { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { changeLocale, saveSettings } from "@/app/[locale]/(protected)/actions";
import { requireUser } from "@/lib/auth/session";
import { DEFAULT_LAYOUT } from "@/lib/editor-layout";
import { Settings } from "@/lib/models/settings";
import { User } from "@/lib/models/user";
import { getUserSettings, updateUserSettings } from "@/lib/settings/queries";
import { DEFAULT_SETTINGS } from "@/lib/settings/settings";
import { setupTestDb } from "./test-db";

vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn() }));
vi.mock("@/auth", () => ({ signOut: vi.fn() }));
const setCookie = vi.fn();
vi.mock("next/headers", () => ({ cookies: async () => ({ set: setCookie }) }));

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
      { nickname: "alice", passwordHash: "x" },
      { nickname: "bob", passwordHash: "x" },
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
      appearance: { sidebarCollapsed: false, theme: "dark", locale: null },
    });
  });

  it("saves the system theme as null", async () => {
    await saveSettings({ appearance: { theme: "dark" } });
    expect(await saveSettings({ appearance: { theme: null } })).toEqual({
      ok: true,
    });

    const [stored] = await Settings.find().lean();
    expect(stored.appearance).toEqual({ theme: null });
    const { appearance } = await getUserSettings(alice.toString());
    expect(appearance.theme).toBeNull();
  });

  it("saves the collapsed sidebar", async () => {
    await saveSettings({ appearance: { sidebarCollapsed: true } });

    const { appearance } = await getUserSettings(alice.toString());
    expect(appearance.sidebarCollapsed).toBe(true);
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
      // Only through changeLocale, which also sets the cookie.
      { appearance: { locale: "pl" } },
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

describe("changeLocale", () => {
  beforeEach(() => setCookie.mockReset());

  it("saves the language and sets the cookie", async () => {
    expect(await changeLocale("pl")).toEqual({ ok: true });

    expect((await getUserSettings(alice.toString())).appearance.locale).toBe(
      "pl",
    );
    expect(setCookie).toHaveBeenCalledWith(
      "NEXT_LOCALE",
      "pl",
      expect.objectContaining({ path: "/", maxAge: 60 * 60 * 24 * 365 }),
    );
    expect((await getUserSettings(bob.toString())).appearance.locale).toBe(
      null,
    );
  });

  it.each(["de", "", null, 7, { locale: "pl" }])(
    "rejects %j",
    async (locale) => {
      expect(await changeLocale(locale)).toMatchObject({
        ok: false,
        error: "INVALID_INPUT",
      });
      expect(await stored(alice)).toBeNull();
      expect(setCookie).not.toHaveBeenCalled();
    },
  );

  it("ignores an unknown stored language", async () => {
    await Settings.collection.insertOne({
      userId: alice,
      appearance: { locale: "xx" },
    });
    expect((await getUserSettings(alice.toString())).appearance.locale).toBe(
      null,
    );
  });

  it("requires a session", async () => {
    vi.mocked(requireUser).mockResolvedValue({
      ok: false,
      error: "UNAUTHORIZED",
      message: "Your session has expired. Please sign in again.",
    });
    expect(await changeLocale("pl")).toMatchObject({ error: "UNAUTHORIZED" });
    expect(setCookie).not.toHaveBeenCalled();
  });
});
