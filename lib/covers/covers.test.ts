import { describe, expect, it } from "vitest";
import {
  coverAdultThreshold,
  coversMaxTotalBytes,
  isAdultScores,
  MAX_UPLOAD_BYTES,
  nextAttemptAt,
  parseClassification,
  validateUpload,
} from "./covers";

const WEBP = Buffer.from(
  "UklGRjoAAABXRUJQVlA4IC4AAADwAQCdASoCAAMAAUAmJaACdLoB+AAEyAAA/q4X/zYEDND6YP/SbPE2eJs+OYAA",
  "base64",
);
const JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAADAAIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwBtFFFeWeyf/9k=",
  "base64",
);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);

describe("validateUpload", () => {
  it("accepts WebP, JPEG and PNG bytes", () => {
    for (const bytes of [WEBP, JPEG, PNG]) {
      expect(validateUpload(bytes)).toEqual({ ok: true });
    }
  });

  it("goes by the bytes, not the name or declared type", () => {
    for (const bytes of [
      Buffer.from("<svg/>"),
      Buffer.from("GIF89a"),
      Buffer.alloc(0),
    ]) {
      expect(validateUpload(bytes)).toMatchObject({
        ok: false,
        error: "INVALID_INPUT",
        key: "coverInvalid",
      });
    }
  });

  it("rejects more than the scaled size", () => {
    const large = Buffer.concat([WEBP, Buffer.alloc(MAX_UPLOAD_BYTES)]);
    expect(validateUpload(large)).toMatchObject({
      error: "TOO_LARGE",
      key: "coverTooLarge",
    });
  });
});

describe("settings from the environment", () => {
  it("defaults to 200 MB and 0.5", () => {
    expect(coversMaxTotalBytes({})).toBe(200 * 1024 * 1024);
    expect(coverAdultThreshold({})).toBe(0.5);
  });

  it("reads valid values and ignores the rest", () => {
    expect(coversMaxTotalBytes({ COVERS_MAX_TOTAL_MB: "50" })).toBe(
      50 * 1024 * 1024,
    );
    expect(coversMaxTotalBytes({ COVERS_MAX_TOTAL_MB: "-1" })).toBe(
      200 * 1024 * 1024,
    );
    expect(coverAdultThreshold({ COVERS_ADULT_THRESHOLD: "0.3" })).toBe(0.3);
    expect(coverAdultThreshold({ COVERS_ADULT_THRESHOLD: "2" })).toBe(0.5);
    expect(coverAdultThreshold({ COVERS_ADULT_THRESHOLD: "x" })).toBe(0.5);
  });
});

describe("isAdultScores", () => {
  it("is 18+ when NSFW or NSFL passes the threshold", () => {
    expect(isAdultScores({ nsfl: 0.1, nsfw: 0.6, sfw: 0.3 }, 0.5)).toBe(true);
    expect(isAdultScores({ nsfl: 0.6, nsfw: 0.1, sfw: 0.3 }, 0.5)).toBe(true);
    expect(isAdultScores({ nsfl: 0.2, nsfw: 0.3, sfw: 0.5 }, 0.5)).toBe(false);
    expect(isAdultScores({ nsfl: 0.2, nsfw: 0.3, sfw: 0.5 }, 0.25)).toBe(true);
  });
});

describe("nextAttemptAt", () => {
  const upload = new Date("2026-03-01T10:00:00.000Z");
  const after = (failed: number) =>
    (nextAttemptAt(upload, failed) ?? upload).getTime() - upload.getTime();

  it("retries 5 min, 30 min and 24 h after the upload, then gives up", () => {
    expect(after(1)).toBe(5 * 60_000);
    expect(after(2)).toBe(30 * 60_000);
    expect(after(3)).toBe(24 * 60 * 60_000);
    expect(nextAttemptAt(upload, 4)).toBeNull();
  });
});

describe("parseClassification", () => {
  const valid = {
    model: "m",
    scores: { nsfl: 0.1, nsfw: 0.2, sfw: 0.7 },
    image: WEBP.toString("base64"),
  };

  it("reads the scores and the re-encoded image", () => {
    expect(parseClassification(valid)).toEqual({
      model: "m",
      scores: valid.scores,
      image: WEBP,
    });
  });

  it("is no verdict for a malformed answer", () => {
    for (const value of [
      null,
      "x",
      { ...valid, model: 1 },
      { ...valid, scores: { ...valid.scores, nsfw: 2 } },
      { ...valid, scores: null },
      { ...valid, image: JPEG.toString("base64") },
    ]) {
      expect(parseClassification(value)).toBeNull();
    }
  });
});
