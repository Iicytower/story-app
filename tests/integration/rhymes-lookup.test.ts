import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lookUpRhymes } from "@/app/[locale]/(protected)/chapters/[id]/dictionary-actions";
import type { ActionError } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import { DICTIONARY_TIMEOUT_MS } from "@/lib/tools/dictionary";
import { NO_FILTERS } from "@/lib/tools/rhymes";

vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn() }));

const URL = "http://tools.test:8110";
const SECRET = "tools-secret-for-tests";

const unauthorized: ActionError = {
  ok: false,
  error: "UNAUTHORIZED",
  message: "Your session has expired. Please sign in again.",
};
const unavailable: ActionError = {
  ok: false,
  error: "TOOL_UNAVAILABLE",
  message: "This tool is not available right now. Try again later.",
};

const row = (form: string, phones: string, lemmas: string, freq = 400) => ({
  form,
  phones,
  freq,
  lemmas,
  flags: 0,
});

// The service's answer for "kota" (task 34): the row of the spelling and each level's rows.
const KOTA = {
  source: "rhymes",
  self: [
    {
      ...row("kota", "kota", "1,2"),
      exact: "ota",
      near: "oPa",
      last: "ta",
    },
  ],
  exact: [row("kota", "kota", "1,2"), row("złota", "zwota", "3")],
  near: [row("woda", "voda", "4")],
  last: [row("lata", "lata", "5", 100)],
};

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.mocked(requireUser).mockResolvedValue({
    ok: true,
    userId: "65f000000000000000000001",
  });
  process.env.TOOLS_API_URL = URL;
  process.env.TOOLS_API_SECRET = SECRET;
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => Response.json(KOTA));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.TOOLS_API_URL;
  delete process.env.TOOLS_API_SECRET;
});

describe("lookUpRhymes", () => {
  it("gives the rhymes by level, with the sources", async () => {
    expect(await lookUpRhymes(" kota ")).toEqual({
      ok: true,
      word: "kota",
      groups: [
        { level: "exact", words: ["złota"], more: [] },
        { level: "near", words: ["woda"], more: [] },
        { level: "last", words: [], more: ["lata"] },
      ],
      sources: ["polimorf", "wordfreq"],
      filters: NO_FILTERS,
    });
  });

  it("sends the word's spellings and the keys of the form as typed (criterion 6)", async () => {
    await lookUpRhymes("Kota");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${URL}/dict/rhymes`);
    expect(init?.method).toBe("POST");
    expect(init?.headers).toEqual({ "X-Tools-Secret": SECRET });
    // "kota", not its lemma "kot" (exact key "ot").
    expect(JSON.parse(init?.body as string)).toEqual({
      forms: ["Kota", "kota", "KOTA"],
      keys: { exact: "ota", near: "oPa", last: "ta" },
    });
  });

  it("sends the filters to the service and gives them back (criteria 1–3)", async () => {
    const filters = { pos: "adjective", min: 2, max: 3 };
    const result = await lookUpRhymes("kota", filters);
    expect(result).toMatchObject({ ok: true, filters });
    expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toEqual({
      forms: ["kota", "Kota", "KOTA"],
      keys: { exact: "ota", near: "oPa", last: "ta" },
      filters: { pos: 2, min: 2, max: 3 },
    });
  });

  it("sends only the filters that narrow, and none when all are off", async () => {
    await lookUpRhymes("kota", { pos: null, min: 1, max: 6 });
    await lookUpRhymes("kota", { pos: "other", min: 1, max: 6 });
    await lookUpRhymes("kota", { pos: null, min: 6, max: 6 });
    const sent = fetchMock.mock.calls.map(
      ([, init]) => JSON.parse(init?.body as string).filters,
    );
    expect(sent).toEqual([undefined, { pos: 16 }, { min: 6 }]);
  });

  it.each([
    { pos: "pronoun", min: 1, max: 6 },
    { pos: null, min: 3, max: 2 },
    { pos: null, min: 0, max: 6 },
    { pos: null, min: 1, max: 7 },
    { pos: null, min: 1.5, max: 6 },
    { min: 1, max: 6 },
    null,
  ])(
    "rejects the filters %j with INVALID_INPUT, with no network call",
    async (filters) => {
      expect(await lookUpRhymes("kota", filters)).toEqual({
        ok: false,
        error: "INVALID_INPUT",
        message: "Choose a part of speech and syllables from the list.",
      });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("gives no groups for a word without rhymes (criterion 7)", async () => {
    fetchMock.mockImplementation(async () =>
      Response.json({
        source: "rhymes",
        self: [],
        exact: [],
        near: [],
        last: [],
      }),
    );
    expect(await lookUpRhymes("xyzq")).toEqual({
      ok: true,
      word: "xyzq",
      groups: [],
      sources: [],
      filters: NO_FILTERS,
    });
  });

  it("asks nothing for a word without a vowel", async () => {
    expect(await lookUpRhymes("pkt")).toEqual({
      ok: true,
      word: "pkt",
      groups: [],
      sources: [],
      filters: NO_FILTERS,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses without a session, with no network call", async () => {
    vi.mocked(requireUser).mockResolvedValue(unauthorized);
    expect(await lookUpRhymes("kota")).toEqual(unauthorized);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["TOOLS_API_URL", "TOOLS_API_SECRET"])(
    "reports the tool as unavailable without %s, with no network call (criterion 8)",
    async (name) => {
      delete process.env[name];
      expect(await lookUpRhymes("kota")).toEqual(unavailable);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it.each(["", "dwa słowa", "x".repeat(51), 7, null])(
    "rejects %j with INVALID_INPUT, with no network call",
    async (value) => {
      expect(await lookUpRhymes(value)).toEqual({
        ok: false,
        error: "INVALID_INPUT",
        message: "Type one word of up to 50 characters.",
      });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("gives up on a hanging service after 2 seconds", async () => {
    fetchMock.mockImplementation(
      (_, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(init.signal!.reason),
          );
        }),
    );
    const started = performance.now();
    const result = await lookUpRhymes("kota");
    const elapsed = performance.now() - started;

    expect(result).toEqual({
      ok: false,
      error: "TIMEOUT",
      message: "The dictionary did not answer in time. Try again.",
    });
    expect(elapsed).toBeGreaterThanOrEqual(DICTIONARY_TIMEOUT_MS - 50);
    expect(elapsed).toBeLessThan(DICTIONARY_TIMEOUT_MS + 500);
  });

  it.each([
    ["the server is down", () => Promise.reject(new TypeError("fetch failed"))],
    [
      "the service has no rhymes yet",
      () =>
        Promise.resolve(Response.json({ error: "NO_DATA" }, { status: 503 })),
    ],
    [
      "the server answers with an error",
      () =>
        Promise.resolve(
          new Response(`Error: secret ${SECRET} at ${URL}`, { status: 500 }),
        ),
    ],
    [
      "the answer has the shape of /synonyms",
      () =>
        Promise.resolve(
          Response.json({
            lemmas: {},
            synonyms: { wiktionary: [], thesaurus: [] },
          }),
        ),
    ],
    [
      "a row is malformed",
      () =>
        Promise.resolve(Response.json({ ...KOTA, near: [{ form: "woda" }] })),
    ],
  ])("reports the tool as unavailable when %s", async (_, answer) => {
    fetchMock.mockImplementation(answer);
    const result = await lookUpRhymes("kota");
    expect(result).toEqual(unavailable);
    const json = JSON.stringify(result);
    expect(json).not.toContain(SECRET);
    expect(json).not.toContain("tools.test");
  });
});
