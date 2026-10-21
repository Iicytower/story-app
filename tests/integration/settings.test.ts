import { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveSettings } from "@/app/(protected)/actions";
import { requireUser } from "@/lib/auth/session";
import { DEFAULT_LAYOUT } from "@/lib/editor-layout";
import { User } from "@/lib/models/user";
import { getUserSettings } from "@/lib/settings/queries";
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

describe("saveSettings", () => {
  it("returns the defaults for a user who never changed anything", async () => {
    expect(await getUserSettings(alice.toString())).toEqual(DEFAULT_SETTINGS);
  });

  it("saves each field without touching the others", async () => {
    expect(await saveSettings({ editorLayout: layout })).toEqual({ ok: true });
    expect(await saveSettings({ theme: "dark" })).toEqual({ ok: true });
    expect(await saveSettings({ mobileView: "notes" })).toEqual({ ok: true });

    expect(await getUserSettings(alice.toString())).toEqual({
      editorLayout: layout,
      theme: "dark",
      mobileView: "notes",
    });
  });

  it("changes only the signed-in user's settings", async () => {
    await saveSettings({ theme: "dark", editorLayout: layout });

    expect(await getUserSettings(bob.toString())).toEqual(DEFAULT_SETTINGS);
  });

  it("rejects invalid input and stores a normalized layout", async () => {
    expect(await saveSettings({ theme: "blue" })).toMatchObject({
      ok: false,
      error: "INVALID_INPUT",
    });
    expect(await saveSettings("dark")).toMatchObject({ ok: false });

    await saveSettings({ editorLayout: { split: true, widths: { x: 1 } } });
    const stored = await User.findById(alice).lean();
    expect(stored?.settings).toEqual({
      editorLayout: { ...DEFAULT_LAYOUT, split: true },
    });
  });

  it("falls back to defaults for broken stored settings", async () => {
    await User.collection.updateOne(
      { _id: alice },
      { $set: { settings: { theme: 7, editorLayout: "wide", mobileView: "x" } } },
    );
    expect(await getUserSettings(alice.toString())).toEqual(DEFAULT_SETTINGS);
  });

  it("requires a session", async () => {
    vi.mocked(requireUser).mockResolvedValue({
      ok: false,
      error: "UNAUTHORIZED",
      message: "Your session has expired. Please sign in again.",
    });
    expect(await saveSettings({ theme: "dark" })).toMatchObject({
      ok: false,
      error: "UNAUTHORIZED",
    });
    expect((await User.findById(alice).lean())?.settings).toBeUndefined();
  });
});
