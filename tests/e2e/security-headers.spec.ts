import type { Response } from "@playwright/test";
import { findFolder, seedStory, withE2EDb } from "./db";
import { storageStatePath } from "./env";
import { expect, markdownEditor, test } from "./helpers";

test.use({ storageState: storageStatePath("alice") });

function expectSecurityHeaders(response: Response | null) {
  const headers = response!.headers();
  const csp = headers["content-security-policy"];
  expect(csp).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
  for (const directive of [
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ]) {
    expect(csp).toContain(directive);
  }
  expect(headers).toMatchObject({
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
    "x-frame-options": "DENY",
    "strict-transport-security": "max-age=63072000; includeSubDomains",
  });
  expect(headers["permissions-policy"]).toContain("camera=()");
  expect(headers["x-powered-by"]).toBeUndefined();
  return csp;
}

async function publishedBook() {
  await seedStory("alice", { title: "Open", folder: "Book", content: "Text" });
  const folder = await findFolder("Book");
  await withE2EDb(async (connection) => {
    await connection
      .collection("folders")
      .updateOne({ _id: folder!._id }, { $set: { published: true } });
    await connection
      .collection("stories")
      .updateMany(
        { folderId: folder!._id },
        { $set: { publication: "public" } },
      );
  });
}

test("the home page, the editor and a public page send the security headers", async ({
  page,
}) => {
  const home = expectSecurityHeaders(await page.goto("/"));
  // A new nonce for every request.
  expect(expectSecurityHeaders(await page.reload())).not.toBe(home);

  const id = await seedStory("alice", { title: "Headers", content: "Text" });
  expectSecurityHeaders(await page.goto(`/chapters/${id}`));
  // The editor, Preview and Source run under the policy; the fixture fails on any violation.
  const content = markdownEditor(page, "Content");
  await content.setSource("**bold** and a [link](https://example.com)");
  expect(await content.source()).toContain("**bold**");

  await publishedBook();
  const reader = await page.context().browser()!.newContext();
  const response = await (await reader.newPage()).goto("/p/Alice/book");
  expect(response!.status()).toBe(200);
  expectSecurityHeaders(response);
  await reader.close();
});

test("the app cannot be framed", async ({ page, baseURL }) => {
  // A frame on another origin; about:blank's own page has no policy.
  await page.goto("about:blank");
  await page.setContent(`<iframe src="${baseURL}/en"></iframe>`);
  // Chromium replaces a refused frame with its error page.
  await expect.poll(() => page.frames()[1]?.url()).toMatch(/^chrome-error:/);
});
