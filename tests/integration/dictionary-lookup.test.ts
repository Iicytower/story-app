import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lookUpLemmas } from "@/app/[locale]/(protected)/stories/[id]/dictionary-actions";
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

// The service's answer for "kota" (task 25): rows of the forms the app asked for.
const KOTA = {
  source: "polimorf",
  rows: [
    { form: "Kota", lemma: "Kot" },
    { form: "kota", lemma: "kot" },
    { form: "kota", lemma: "kota" },
  ],
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

describe("lookUpLemmas", () => {
  it("finds every lemma of an inflected form, with its source", async () => {
    expect(await lookUpLemmas(" kota ")).toEqual({
      ok: true,
      word: "kota",
      lemmas: [
        { lemma: "kot", source: "polimorf" },
        { lemma: "kota", source: "polimorf" },
        { lemma: "Kot", source: "polimorf" },
      ],
    });
  });

  it("sends only the word's spellings, with the secret in a header", async () => {
    await lookUpLemmas("kota");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${URL}/dict/lemmas`);
    expect(init?.method).toBe("POST");
    expect(init?.headers).toEqual({ "X-Tools-Secret": SECRET });
    expect(JSON.parse(init?.body as string)).toEqual({
      forms: ["kota", "Kota", "KOTA"],
    });
  });

  it("gives an empty list for an unknown word", async () => {
    fetchMock.mockImplementation(async () =>
      Response.json({ source: "polimorf", rows: [] }),
    );
    expect(await lookUpLemmas("xyzq")).toEqual({
      ok: true,
      word: "xyzq",
      lemmas: [],
    });
  });

  it("refuses without a session, with no network call", async () => {
    vi.mocked(requireUser).mockResolvedValue(unauthorized);
    expect(await lookUpLemmas("kota")).toEqual(unauthorized);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["TOOLS_API_URL", "TOOLS_API_SECRET"])(
    "reports the tool as unavailable without %s, with no network call",
    async (name) => {
      delete process.env[name];
      expect(await lookUpLemmas("kota")).toEqual(unavailable);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it.each(["", "dwa słowa", "x".repeat(51), 7, null, { word: "kot" }])(
    "rejects %j with INVALID_INPUT, with no network call",
    async (value) => {
      expect(await lookUpLemmas(value)).toEqual({
        ok: false,
        error: "INVALID_INPUT",
        message: "Type one word of up to 50 characters.",
      });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("gives up on a hanging service after 2 seconds", async () => {
    // Never answers; only the action's own signal ends the call, as with a hung service.
    fetchMock.mockImplementation(
      (_, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(init.signal!.reason),
          );
        }),
    );
    const started = performance.now();
    const result = await lookUpLemmas("kota");
    const elapsed = performance.now() - started;

    expect(result).toEqual({
      ok: false,
      error: "TIMEOUT",
      message: "The dictionary did not answer in time. Try again.",
    });
    expect(DICTIONARY_TIMEOUT_MS).toBe(2000);
    expect(elapsed).toBeGreaterThanOrEqual(DICTIONARY_TIMEOUT_MS - 50);
    expect(elapsed).toBeLessThan(DICTIONARY_TIMEOUT_MS + 500);
  });

  it.each([
    ["the server is down", () => Promise.reject(new TypeError("fetch failed"))],
    [
      "the gateway refuses the secret",
      () => Promise.resolve(new Response(null, { status: 401 })),
    ],
    [
      "the service has no data yet",
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
      "the answer is not JSON",
      () => Promise.resolve(new Response("<html>", { status: 200 })),
    ],
    [
      "the answer has another shape",
      () => Promise.resolve(Response.json({ lemmas: ["kot"] })),
    ],
  ])("reports the tool as unavailable when %s", async (_, answer) => {
    fetchMock.mockImplementation(answer);
    const result = await lookUpLemmas("kota");
    expect(result).toEqual(unavailable);
    const json = JSON.stringify(result);
    expect(json).not.toContain(SECRET);
    expect(json).not.toContain("tools.test");
  });
});
