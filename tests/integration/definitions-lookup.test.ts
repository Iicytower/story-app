import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lookUpDefinitions } from "@/app/[locale]/(protected)/stories/[id]/dictionary-actions";
import type { ActionError } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import { DICTIONARY_TIMEOUT_MS } from "@/lib/tools/dictionary";

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

const KOT = [
  {
    pos: "noun",
    posTitle: "rzeczownik",
    senses: [
      {
        index: "1.1",
        gloss: "Felis catus, zwierzę domowe",
        labels: [],
        examples: ["Kot goni za myszą."],
      },
    ],
  },
];

// The service's answer for "kota" (task 32): lemma rows and the entries of spellings and lemmas.
const KOTA = {
  lemmas: {
    source: "polimorf",
    rows: [
      { form: "kota", lemma: "kot" },
      { form: "kota", lemma: "kota" },
    ],
  },
  definitions: { source: "wiktionary", rows: [{ word: "kot", entries: KOT }] },
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

describe("lookUpDefinitions", () => {
  it("shows the senses of the lemma of an inflected form, with the sources", async () => {
    expect(await lookUpDefinitions(" kota ")).toEqual({
      ok: true,
      word: "kota",
      groups: [{ headword: "kot", entries: KOT }],
      sources: ["wiktionary", "polimorf"],
    });
  });

  it("sends only the word's spellings, with the secret in a header", async () => {
    await lookUpDefinitions("Kota");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${URL}/dict/definitions`);
    expect(init?.method).toBe("POST");
    expect(init?.headers).toEqual({ "X-Tools-Secret": SECRET });
    expect(JSON.parse(init?.body as string)).toEqual({
      forms: ["Kota", "kota", "KOTA"],
    });
  });

  it("gives no groups for an unknown word", async () => {
    fetchMock.mockImplementation(async () =>
      Response.json({
        lemmas: { source: "polimorf", rows: [] },
        definitions: { source: "wiktionary", rows: [] },
      }),
    );
    expect(await lookUpDefinitions("xyzq")).toEqual({
      ok: true,
      word: "xyzq",
      groups: [],
      sources: [],
    });
  });

  it("refuses without a session, with no network call", async () => {
    vi.mocked(requireUser).mockResolvedValue(unauthorized);
    expect(await lookUpDefinitions("kota")).toEqual(unauthorized);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["TOOLS_API_URL", "TOOLS_API_SECRET"])(
    "reports the tool as unavailable without %s, with no network call",
    async (name) => {
      delete process.env[name];
      expect(await lookUpDefinitions("kota")).toEqual(unavailable);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it.each(["", "dwa słowa", "x".repeat(51), 7, null])(
    "rejects %j with INVALID_INPUT, with no network call",
    async (value) => {
      expect(await lookUpDefinitions(value)).toEqual({
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
    const result = await lookUpDefinitions("kota");
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
      "the service has no definitions yet",
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
      "the answer has the shape of /lemmas",
      () => Promise.resolve(Response.json(KOTA.lemmas)),
    ],
    [
      "the definitions come from an unknown source",
      () =>
        Promise.resolve(
          Response.json({
            ...KOTA,
            definitions: { ...KOTA.definitions, source: "sjp" },
          }),
        ),
    ],
    [
      "a sense is malformed",
      () =>
        Promise.resolve(
          Response.json({
            ...KOTA,
            definitions: {
              source: "wiktionary",
              rows: [{ word: "kot", entries: [{ pos: "noun", senses: [{}] }] }],
            },
          }),
        ),
    ],
  ])("reports the tool as unavailable when %s", async (_, answer) => {
    fetchMock.mockImplementation(answer);
    const result = await lookUpDefinitions("kota");
    expect(result).toEqual(unavailable);
    const json = JSON.stringify(result);
    expect(json).not.toContain(SECRET);
    expect(json).not.toContain("tools.test");
  });
});
