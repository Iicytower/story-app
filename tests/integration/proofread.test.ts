import { Types } from "mongoose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkChapter } from "@/app/[locale]/(protected)/chapters/[id]/proofread-actions";
import type { ActionError } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import { Folder } from "@/lib/models/folder";
import { RateLimit } from "@/lib/models/rate-limit";
import { Story } from "@/lib/models/story";
import { Settings } from "@/lib/models/settings";
import { PROOFREAD_LIMIT } from "@/lib/rate-limit";
import { setupTestDb } from "./test-db";

vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn() }));

setupTestDb();

const alice = new Types.ObjectId();
const bob = new Types.ObjectId();
const URL = "http://tools.test:8110";
const SECRET = "tools-secret-for-tests";

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

// A canned LanguageTool answer: "Kot kot" repeats a word in a sentence (PL_WORD_REPEAT).
const LT_RESPONSE = {
  matches: [
    {
      message: "Powtórzone słowo",
      offset: 6,
      length: 3,
      replacements: [],
      rule: {
        id: "PL_WORD_REPEAT",
        issueType: "style",
        category: { id: "STYLE" },
      },
    },
  ],
};

const fetchMock = vi.fn<typeof fetch>();

beforeEach(async () => {
  // The database is shared by the whole file, and every test checks as Alice.
  await RateLimit.deleteMany({});
  signInAs(alice);
  process.env.TOOLS_API_URL = URL;
  process.env.TOOLS_API_SECRET = SECRET;
  fetchMock.mockReset();
  // A new Response each time: a body can be read only once.
  fetchMock.mockImplementation(async () => Response.json(LT_RESPONSE));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.TOOLS_API_URL;
  delete process.env.TOOLS_API_SECRET;
});

async function seedChapter(
  content = "# Rozdział\n\nKot **kot** śpi.",
  userId = alice,
  folder: Record<string, unknown> = {},
) {
  const { _id: folderId } = await Folder.create({
    userId,
    name: `Book ${new Types.ObjectId()}`,
    ...folder,
  });
  const { _id } = await Story.create({
    userId,
    folderId,
    title: "Jeden",
    content,
  });
  return _id.toString();
}

function sentBody() {
  const [, init] = fetchMock.mock.calls[0];
  return init?.body as URLSearchParams;
}

describe("checkChapter", () => {
  it("returns the issues with offsets in the markdown source and the checked text", async () => {
    const id = await seedChapter("Ala **ma** kot kot.");
    const result = await checkChapter(id);

    expect(result).toEqual({
      ok: true,
      content: "Ala **ma** kot kot.",
      language: "pl",
      issues: [
        {
          offset: 6,
          length: 3,
          kind: "style",
          message: "Powtórzone słowo",
          replacements: [],
          ruleId: "PL_WORD_REPEAT",
        },
      ],
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${URL}/lt/v2/check`);
    expect(init?.method).toBe("POST");
    expect(init?.headers).toEqual({ "X-Tools-Secret": SECRET });
  });

  it("sends the stored content as annotated data, with markdown as markup", async () => {
    const id = await seedChapter("# Tytuł\n\nKot **kot**.");
    await checkChapter(id);

    const body = sentBody();
    expect(body.has("text")).toBe(false);
    const { annotation } = JSON.parse(body.get("data")!) as {
      annotation: ({ text: string } | { markup: string })[];
    };
    expect(
      annotation.flatMap((part) => ("text" in part ? [part.text] : [])),
    ).toEqual(["Tytuł", "Kot ", "kot", "."]);
    expect(
      annotation
        .map((part) => ("text" in part ? part.text : part.markup))
        .join(""),
    ).toBe("# Tytuł\n\nKot **kot**.");
  });

  it("leaves out spelling issues of words in the user's dictionary only", async () => {
    // "Ania" twice as a spelling issue, once as a grammar issue on "kwak".
    const content = "Ania i ania, kwak.";
    const match = (offset: number, length: number, category: string) => ({
      message: "",
      offset,
      length,
      replacements: [],
      rule: { id: "MORFOLOGIK_RULE_PL_PL", category: { id: category } },
    });
    fetchMock.mockImplementation(async () =>
      Response.json({
        matches: [
          match(0, 4, "TYPOS"),
          match(7, 4, "TYPOS"),
          match(13, 4, "GRAMMAR"),
        ],
      }),
    );
    await Settings.create([
      { userId: alice, proofreading: { dictionary: ["Ania", "kwak"] } },
      { userId: bob, proofreading: { dictionary: ["ania"] } },
    ]);
    const issues = async (userId: Types.ObjectId) => {
      signInAs(userId);
      const result = await checkChapter(await seedChapter(content, userId));
      return result.ok ? result.issues.map(({ offset }) => offset) : result;
    };

    expect(await issues(alice)).toEqual([7, 13]);
    expect(await issues(bob)).toEqual([13]);
    await Settings.deleteMany({});
  });

  it("always enables word repetition within a sentence", async () => {
    await checkChapter(await seedChapter());
    expect(sentBody().get("enabledRules")).toBe("PL_WORD_REPEAT");
  });

  it("checks in the folder's language, Polish when the folder has none", async () => {
    const withoutLanguage = await seedChapter();
    await Folder.collection.updateMany({}, { $unset: { language: "" } });
    const result = await checkChapter(withoutLanguage);
    expect(result).toMatchObject({ ok: true, language: "pl" });
    expect(sentBody().get("language")).toBe("pl-PL");

    fetchMock.mockClear();
    const chosen = await seedChapter(undefined, alice, { language: "pl" });
    await checkChapter(chosen);
    expect(sentBody().get("language")).toBe("pl-PL");
  });

  it("does not check another user's chapter", async () => {
    const id = await seedChapter(undefined, bob);
    expect(await checkChapter(id)).toMatchObject({
      ok: false,
      error: "NOT_FOUND",
    });
    expect(await checkChapter("not-an-id")).toMatchObject({
      ok: false,
      error: "NOT_FOUND",
    });
    const deleted = await seedChapter();
    await Story.updateOne({ _id: deleted }, { deletedAt: new Date() });
    expect(await checkChapter(deleted)).toMatchObject({ error: "NOT_FOUND" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses without a session", async () => {
    const id = await seedChapter();
    signInAs(null);
    expect(await checkChapter(id)).toEqual(unauthorized);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["TOOLS_API_URL", "TOOLS_API_SECRET"])(
    "reports the tool as unavailable without %s, with no network call",
    async (name) => {
      const id = await seedChapter();
      delete process.env[name];
      expect(await checkChapter(id)).toEqual({
        ok: false,
        error: "TOOL_UNAVAILABLE",
        message: "This tool is not available right now. Try again later.",
      });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("reports a timeout", async () => {
    fetchMock.mockRejectedValue(
      new DOMException("The operation timed out.", "TimeoutError"),
    );
    expect(await checkChapter(await seedChapter())).toMatchObject({
      ok: false,
      error: "TIMEOUT",
    });
  });

  it("aborts the call after the time limit", async () => {
    await checkChapter(await seedChapter());
    const [, init] = fetchMock.mock.calls[0];
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it.each([
    ["the server is down", () => Promise.reject(new TypeError("fetch failed"))],
    [
      "the server answers with an error",
      () =>
        Promise.resolve(
          new Response(`Error: secret ${SECRET} at ${URL}`, { status: 500 }),
        ),
    ],
    [
      "the answer is not JSON",
      () => Promise.resolve(new Response("<html>", { status: 200 })),
    ],
  ])("reports the tool as unavailable when %s", async (_, answer) => {
    fetchMock.mockImplementation(answer);
    const result = await checkChapter(await seedChapter());
    expect(result).toEqual({
      ok: false,
      error: "TOOL_UNAVAILABLE",
      message: "This tool is not available right now. Try again later.",
    });
  });

  it("never returns the tools server's address or secret", async () => {
    const id = await seedChapter();
    const results = [await checkChapter(id)];
    fetchMock.mockRejectedValue(new TypeError(`connect ECONNREFUSED ${URL}`));
    results.push(await checkChapter(id));
    for (const result of results) {
      const json = JSON.stringify(result);
      expect(json).not.toContain(SECRET);
      expect(json).not.toContain("tools.test");
    }
  });

  it("limits how often a user can check", async () => {
    const id = await seedChapter();
    for (let i = 0; i < PROOFREAD_LIMIT.max; i++) {
      expect(await checkChapter(id)).toMatchObject({ ok: true });
    }
    expect(await checkChapter(id)).toMatchObject({
      ok: false,
      error: "RATE_LIMITED",
    });
    expect(fetchMock).toHaveBeenCalledTimes(PROOFREAD_LIMIT.max);

    signInAs(bob);
    expect(await checkChapter(await seedChapter(undefined, bob))).toMatchObject(
      { ok: true },
    );
  });
});
