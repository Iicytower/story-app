import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { classifyCover } from "./classify";
import { AVATAR_SIZE, COVER_SIZE } from "./covers";

const CONFIG = { url: "http://tools.test", secret: "secret" };
const WEBP = Buffer.from(
  "UklGRjoAAABXRUJQVlA4IC4AAADwAQCdASoCAAMAAUAmJaACdLoB+AAEyAAA/q4X/zYEDND6YP/SbPE2eJs+OYAA",
  "base64",
);

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () =>
    Response.json({
      model: "model",
      scores: { nsfl: 0, nsfw: 0, sfw: 1 },
      image: WEBP.toString("base64"),
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("classifyCover", () => {
  // The classifier deployed before task 70 answers 404 to any other path.
  it("sends a cover to the bare /classify path", async () => {
    await classifyCover(CONFIG, WEBP);
    await classifyCover(CONFIG, WEBP, COVER_SIZE);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      `${CONFIG.url}/classify`,
      `${CONFIG.url}/classify`,
    ]);
  });

  it("asks for the avatar size", async () => {
    await classifyCover(CONFIG, WEBP, AVATAR_SIZE);
    expect(fetchMock.mock.calls[0][0]).toBe(
      `${CONFIG.url}/classify?size=256x256`,
    );
  });
});
