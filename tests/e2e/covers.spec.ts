import { readFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";
import { strToU8, unzipSync, zipSync } from "fflate";
import type { Page } from "@playwright/test";
import { findFolder, seedStory } from "./db";
import { E2E_TOOLS_PORT, E2E_TOOLS_SECRET, storageStatePath } from "./env";
import { editorAction, expect, menuAction, openMenu, test } from "./helpers";

test.use({ storageState: storageStatePath("alice") });

const BADGE = "For adults only (18+)";

// A solid-colour PNG the browser can decode, crop and re-encode.
function png(width: number, height: number, rgb: [number, number, number]) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (data: Buffer) => {
    let c = 0xffffffff;
    for (const byte of data) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([length, body, sum]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const row = Buffer.concat([
    Buffer.from([0]),
    Buffer.from(Array(width).fill(rgb).flat()),
  ]);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(Buffer.concat(Array(height).fill(row)))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

async function classifier(mode: "safe" | "adult" | "down") {
  await fetch(`http://127.0.0.1:${E2E_TOOLS_PORT}/classify/mode`, {
    method: "POST",
    headers: { "X-Tools-Secret": E2E_TOOLS_SECRET },
    body: mode,
  });
}

async function seedBook() {
  await seedStory("alice", { title: "Night", folder: "Book" });
  return (await findFolder("Book"))!._id.toString();
}

const dialog = (page: Page) =>
  page.getByRole("dialog", { name: "Cover of Book" });

async function upload(page: Page, rgb: [number, number, number]) {
  await dialog(page)
    .getByLabel("Choose image")
    .setInputFiles({
      name: "cover.png",
      mimeType: "image/png",
      buffer: png(40, 30, rgb),
    });
  await expect(
    dialog(page).getByRole("img", { name: "Cover frame" }),
  ).toBeVisible();
  await dialog(page).getByRole("button", { name: "Save cover" }).click();
}

const currentCover = (page: Page) =>
  dialog(page).getByRole("img", { name: "Current cover of Book" });

test.beforeEach(() => classifier("safe"));
test.afterEach(() => classifier("safe"));

test("the owner adds, replaces and removes a folder cover", async ({
  page,
}) => {
  const id = await seedBook();
  await page.goto(`/folders/${id}`);
  await menuAction(page, "Actions for Book", "Cover");
  await expect(
    dialog(page).getByText("This folder has no cover yet."),
  ).toBeVisible();

  await upload(page, [200, 40, 40]);
  await expect(dialog(page).getByRole("status")).toHaveText(
    "The cover is saved.",
  );
  await expect(currentCover(page)).toBeVisible();
  const first = await currentCover(page).getAttribute("src");
  expect(first).toMatch(/^\/covers\/[0-9a-f]{24}$/);
  await expect
    .poll(() =>
      currentCover(page).evaluate((img: HTMLImageElement) => img.naturalWidth),
    )
    .toBe(600);

  await upload(page, [40, 200, 40]);
  await expect(currentCover(page)).not.toHaveAttribute("src", first!);
  expect((await page.request.get(first!)).status()).toBe(404);

  await dialog(page).getByRole("button", { name: "Remove cover" }).click();
  await expect(
    dialog(page).getByText("This folder has no cover yet."),
  ).toBeVisible();
});

test("a cover rated 18+ locks the folder's 18+ mark", async ({ page }) => {
  const id = await seedBook();
  await page.goto(`/folders/${id}`);
  await classifier("adult");
  await menuAction(page, "Actions for Book", "Cover");
  await upload(page, [10, 10, 10]);
  await expect(dialog(page).getByRole("status")).toContainText("rated 18+");
  await expect(
    dialog(page).getByText("The filter rated this cover 18+."),
  ).toBeVisible();
  await page.keyboard.press("Escape");

  await expect(page.getByRole("img", { name: BADGE }).first()).toBeVisible();
  await openMenu(
    page.getByRole("button", { name: "Actions for Book", exact: true }),
  );
  const locked = page.getByRole("menuitem", { name: /Remove 18\+/ });
  await expect(locked).toBeDisabled();
  await expect(locked).toContainText("Locked: an image was rated 18+");
});

test("the owner marks a cover as 18+ by hand", async ({ page }) => {
  const id = await seedBook();
  await page.goto(`/folders/${id}`);
  await menuAction(page, "Actions for Book", "Cover");
  await upload(page, [40, 40, 200]);
  const mark = dialog(page).getByRole("checkbox", {
    name: "Mark the cover as 18+",
  });
  await mark.check();
  await expect(mark).toBeChecked();
  await page.reload();
  await menuAction(page, "Actions for Book", "Cover");
  await expect(mark).toBeChecked();
  // The owner's own cover mark does not mark or lock the folder.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("img", { name: BADGE })).toHaveCount(0);
});

test("without a verdict the new cover waits and the old one stays", async ({
  page,
}) => {
  const id = await seedBook();
  await page.goto(`/folders/${id}`);
  await menuAction(page, "Actions for Book", "Cover");
  await upload(page, [200, 40, 40]);
  await expect(currentCover(page)).toBeVisible();
  const first = await currentCover(page).getAttribute("src");

  await classifier("down");
  await upload(page, [40, 200, 40]);
  await expect(dialog(page).getByRole("status")).toContainText(
    "waiting to be checked",
  );
  await expect(currentCover(page)).toHaveAttribute("src", first!);
});

test("a folder's cover is the title page of an EPUB export", async ({
  page,
}) => {
  const id = await seedBook();
  await page.goto(`/folders/${id}`);
  await menuAction(page, "Actions for Book", "Cover");
  await upload(page, [200, 40, 40]);
  await expect(currentCover(page)).toBeVisible();
  await page.keyboard.press("Escape");

  await editorAction(page, "Export as…");
  await page.getByLabel("Format").selectOption("epub");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const files = unzipSync(await readFile(await (await downloadPromise).path()));
  expect([...files["OEBPS/cover.jpg"].subarray(0, 3)]).toEqual([
    0xff, 0xd8, 0xff,
  ]);
});

test("importing a folder zip brings its cover.webp along", async ({ page }) => {
  const zip = zipSync({
    "01-raz.md": strToU8("Treść raz"),
    "02-dwa.md": strToU8("Treść dwa"),
    "cover.webp": png(30, 45, [40, 40, 200]),
  });
  await page.goto("/stories");
  await page
    .getByRole("button", { name: /^Actions/ })
    .first()
    .click();
  await page.getByRole("menuitem", { name: "Import…" }).click();
  await page.getByLabel("File", { exact: true }).setInputFiles({
    name: "Book.zip",
    mimeType: "application/zip",
    buffer: Buffer.from(zip),
  });
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await expect(page).toHaveURL(/\/folders\/[0-9a-f]{24}$/);

  await menuAction(page, "Actions for Book", "Cover");
  await expect(currentCover(page)).toBeVisible();
});

async function publishBook(page: Page) {
  await menuAction(page, "Actions for Book", "Publish");
  await page
    .getByRole("alertdialog", { name: "Publish folder?" })
    .getByRole("button", { name: "Publish", exact: true })
    .click();
  await expect(page.getByRole("alertdialog")).toBeHidden();
}

async function anonymous(page: Page) {
  const context = await page
    .context()
    .browser()!
    .newContext({ storageState: { cookies: [], origins: [] } });
  return context.newPage();
}

test("the cover shows in the folder list and on the folder page, and changes with it", async ({
  page,
}) => {
  const id = await seedBook();
  await seedStory("alice", { title: "Other", folder: "Plain" });
  await page.goto(`/folders/${id}`);
  const onPage = page.getByRole("img", { name: "Cover of Book" });
  await expect(onPage).toHaveCount(0);
  await menuAction(page, "Actions for Book", "Cover");
  await upload(page, [200, 40, 40]);
  await expect(currentCover(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(onPage).toBeVisible();
  const first = await onPage.getAttribute("src");

  await page.goto("/stories");
  await expect(
    page.getByRole("img", { name: "Cover of Book" }),
  ).toHaveAttribute("src", first!);
  await expect(page.getByRole("img", { name: "Cover of Plain" })).toHaveCount(
    0,
  );

  await page.goto(`/folders/${id}`);
  await menuAction(page, "Actions for Book", "Cover");
  await upload(page, [40, 200, 40]);
  await expect(currentCover(page)).not.toHaveAttribute("src", first!);
  await page.keyboard.press("Escape");
  await expect(onPage).not.toHaveAttribute("src", first!);
  // The new src is set before the image has loaded.
  await expect
    .poll(() => onPage.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBe(600);
});

test("readers see the cover on the contents page, chapter pages, in search and on the home page", async ({
  page,
}) => {
  await seedStory("alice", {
    title: "Night",
    folder: "Book",
    content: "Moonlit",
  });
  const id = (await findFolder("Book"))!._id.toString();
  await page.goto(`/folders/${id}`);
  await publishBook(page);
  await menuAction(page, "Actions for Book", "Cover");
  await upload(page, [200, 40, 40]);
  await expect(currentCover(page)).toBeVisible();

  const visitor = await anonymous(page);
  await visitor.goto("/p/Alice/book");
  await expect(
    visitor.getByRole("img", { name: "Cover of Book" }),
  ).toBeVisible();
  await visitor.goto("/p/Alice/book/night");
  const onChapter = visitor.getByRole("img", { name: "Cover of Book" });
  await expect(onChapter).toBeVisible();
  // Title, then cover, then text.
  const top = async (locator: typeof onChapter) =>
    (await locator.boundingBox())!.y;
  expect(
    await top(visitor.getByRole("heading", { name: "Night" })),
  ).toBeLessThan(await top(onChapter));
  expect(await top(onChapter)).toBeLessThan(
    await top(visitor.getByText("Moonlit")),
  );
  await visitor.goto("/");
  await expect(
    visitor
      .getByRole("region", { name: "Recently published" })
      .getByRole("img", { name: "Cover of Book" }),
  ).toBeVisible();
  const field = visitor.getByRole("searchbox", {
    name: "Search published stories",
  });
  await field.fill("Moonlit");
  await field.press("Enter");
  await expect(
    visitor
      .getByRole("list", { name: "Search results" })
      .getByRole("img", { name: "Cover of Book" }),
  ).toBeVisible();
});

test("an 18+ cover is a badge in search and blurred on the contents and chapter pages", async ({
  page,
}) => {
  await seedStory("alice", {
    title: "Night",
    folder: "Book",
    content: "Moonlit",
  });
  const id = (await findFolder("Book"))!._id.toString();
  await page.goto(`/folders/${id}`);
  await publishBook(page);
  await classifier("adult");
  await menuAction(page, "Actions for Book", "Cover");
  await upload(page, [10, 10, 10]);
  await expect(dialog(page).getByRole("status")).toContainText("rated 18+");

  const visitor = await anonymous(page);
  await visitor.goto("/");
  const field = visitor.getByRole("searchbox", {
    name: "Search published stories",
  });
  await field.fill("Moonlit");
  await field.press("Enter");
  const result = visitor.getByRole("list", { name: "Search results" });
  await expect(result.getByRole("img", { name: BADGE })).toHaveCount(2);
  await expect(result.getByRole("img", { name: "Cover of Book" })).toHaveCount(
    0,
  );

  await visitor.goto("/p/Alice/book/night");
  await expect(visitor.getByRole("img", { name: "Cover of Book" })).toHaveClass(
    /blur/,
  );

  await visitor.goto("/p/Alice/book");
  const cover = visitor.getByRole("img", { name: "Cover of Book" });
  await expect(cover).toHaveClass(/blur/);
  await visitor
    .getByRole("button", { name: "Show the cover (I am 18 or older)" })
    .click();
  await expect(cover).not.toHaveClass(/blur/);
});
