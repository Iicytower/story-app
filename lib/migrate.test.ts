import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decideMigration } from "./migrate";

const URI = "mongodb://example/story-app";

describe("decideMigration", () => {
  it("runs for production", () => {
    expect(
      decideMigration({ VERCEL_ENV: "production", MONGODB_URI: URI }),
    ).toEqual({ run: true });
  });

  it("runs for the staging preview", () => {
    expect(
      decideMigration({
        VERCEL_ENV: "preview",
        VERCEL_GIT_COMMIT_REF: "staging",
        MONGODB_URI: URI,
      }),
    ).toEqual({ run: true });
  });

  it("skips previews of other branches", () => {
    expect(
      decideMigration({
        VERCEL_ENV: "preview",
        VERCEL_GIT_COMMIT_REF: "feature/01-migrations",
      }),
    ).toEqual({
      run: false,
      reason: expect.stringContaining("feature/01-migrations"),
    });
  });

  it("runs outside Vercel", () => {
    expect(decideMigration({ MONGODB_URI: URI })).toEqual({ run: true });
  });

  it("fails without MONGODB_URI on production and staging", () => {
    expect(() => decideMigration({ VERCEL_ENV: "production" })).toThrow(
      "MONGODB_URI is not set for the production build.",
    );
    expect(() =>
      decideMigration({
        VERCEL_ENV: "preview",
        VERCEL_GIT_COMMIT_REF: "staging",
      }),
    ).toThrow("MONGODB_URI is not set for the staging build.");
  });
});

describe("build commands", () => {
  const readJson = (file: string) => JSON.parse(readFileSync(file, "utf8"));

  it("npm run build does not migrate", () => {
    expect(readJson("package.json").scripts.build).toBe("next build");
  });

  it("the Vercel build migrates before next build", () => {
    expect(readJson("vercel.json").buildCommand).toBe(
      "tsx scripts/migrate.ts && next build",
    );
  });
});
