import { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addToDictionary,
  listDictionary,
  removeFromDictionary,
  saveSettings,
} from "@/app/[locale]/(protected)/actions";
import type { ActionError } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import { Settings } from "@/lib/models/settings";
import { MAX_DICTIONARY_WORDS } from "@/lib/proofreading/dictionary";
import { getUserSettings } from "@/lib/settings/queries";
import { setupTestDb } from "./test-db";

vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn() }));
vi.mock("@/auth", () => ({ signOut: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: vi.fn() }) }));

setupTestDb();

const alice = new Types.ObjectId();
const bob = new Types.ObjectId();

function signInAs(userId: Types.ObjectId | null) {
  vi.mocked(requireUser).mockResolvedValue(
    userId
      ? { ok: true, userId: userId.toString() }
      : {
          ok: false,
          error: "UNAUTHORIZED",
          message: "Your session has expired. Please sign in again.",
        },
  );
}

const invalidWord: ActionError = {
  ok: false,
  error: "INVALID_INPUT",
  message:
    "This word cannot be added to the dictionary. Use one word of up to 50 characters.",
};

const stored = async (userId: Types.ObjectId) =>
  (await Settings.findOne({ userId }).lean())?.proofreading?.dictionary;

beforeEach(async () => {
  await Settings.deleteMany({});
  signInAs(alice);
});

describe("dictionary actions", () => {
  it("adds a word once and returns the whole list", async () => {
    expect(await listDictionary()).toEqual({ ok: true, words: [] });
    expect(await addToDictionary(" Ania ")).toEqual({
      ok: true,
      words: ["Ania"],
    });
    expect(await addToDictionary("Kwak")).toEqual({
      ok: true,
      words: ["Ania", "Kwak"],
    });
    expect(await addToDictionary("Ania")).toEqual({
      ok: true,
      words: ["Ania", "Kwak"],
    });
    expect(await stored(alice)).toEqual(["Ania", "Kwak"]);
    expect(await listDictionary()).toEqual({
      ok: true,
      words: ["Ania", "Kwak"],
    });
  });

  it("keeps the other settings and stores no list for users who never added a word", async () => {
    await saveSettings({ appearance: { theme: "dark" } });
    expect(await stored(alice)).toBeUndefined();
    await addToDictionary("Ania");
    expect(await Settings.findOne({ userId: alice }).lean()).toMatchObject({
      appearance: { theme: "dark" },
      proofreading: { dictionary: ["Ania"] },
    });
    expect(
      (await getUserSettings(alice.toString())).proofreading.dictionary,
    ).toEqual(["Ania"]);
  });

  it("removes a word, and removing a missing one is not an error", async () => {
    await addToDictionary("Ania");
    await addToDictionary("Kwak");
    expect(await removeFromDictionary("Ania")).toEqual({
      ok: true,
      words: ["Kwak"],
    });
    expect(await removeFromDictionary("Ania")).toEqual({
      ok: true,
      words: ["Kwak"],
    });
    signInAs(bob);
    expect(await removeFromDictionary("Ania")).toEqual({
      ok: true,
      words: [],
    });
  });

  it("keeps each user's list separate", async () => {
    await addToDictionary("Ania");
    signInAs(bob);
    expect(await listDictionary()).toEqual({ ok: true, words: [] });
    await addToDictionary("Kwak");
    expect(await removeFromDictionary("Ania")).toEqual({
      ok: true,
      words: ["Kwak"],
    });
    expect(await stored(alice)).toEqual(["Ania"]);
    expect(await stored(bob)).toEqual(["Kwak"]);
  });

  it("rejects invalid words with INVALID_INPUT", async () => {
    for (const word of [
      "",
      "  ",
      "dwa słowa",
      "x".repeat(51),
      5,
      null,
      ["a"],
    ]) {
      expect(await addToDictionary(word), JSON.stringify(word)).toEqual(
        invalidWord,
      );
      expect(await removeFromDictionary(word)).toEqual(invalidWord);
    }
    expect(await Settings.countDocuments()).toBe(0);
  });

  it("does not take the list through saveSettings", async () => {
    expect(
      await saveSettings({ proofreading: { dictionary: ["Ania"] } }),
    ).toEqual(expect.objectContaining({ ok: false, error: "INVALID_INPUT" }));
    expect(await stored(alice)).toBeUndefined();
  });

  it("stops at the limit, also for parallel adds", async () => {
    const words = Array.from(
      { length: MAX_DICTIONARY_WORDS - 1 },
      (_, i) => `słowo${i}`,
    );
    await Settings.create({
      userId: alice,
      proofreading: { dictionary: words },
    });

    const results = await Promise.all([
      addToDictionary("Ania"),
      addToDictionary("Kwak"),
    ]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.find((result) => !result.ok)).toEqual({
      ok: false,
      error: "INVALID_INPUT",
      message:
        "The dictionary is full (1000 words). Remove a word in Settings first.",
    });
    expect(await stored(alice)).toHaveLength(MAX_DICTIONARY_WORDS);
    // A word already in the full list is still fine.
    expect(await addToDictionary("słowo0")).toMatchObject({ ok: true });
  });

  it("creates one document when the first adds run in parallel", async () => {
    await Promise.all([addToDictionary("Ania"), addToDictionary("Kwak")]);
    expect(await Settings.countDocuments({ userId: alice })).toBe(1);
    expect((await stored(alice))?.toSorted()).toEqual(["Ania", "Kwak"]);
  });

  it("ignores broken stored entries", async () => {
    await Settings.collection.insertOne({
      userId: alice,
      proofreading: { dictionary: ["Ania", "a b", 7, "Ania"] },
    });
    expect(await listDictionary()).toEqual({ ok: true, words: ["Ania"] });
  });

  it("requires a session", async () => {
    signInAs(null);
    for (const result of [
      await listDictionary(),
      await addToDictionary("Ania"),
      await removeFromDictionary("Ania"),
    ]) {
      expect(result).toMatchObject({ ok: false, error: "UNAUTHORIZED" });
    }
    expect(await Settings.countDocuments()).toBe(0);
  });
});
