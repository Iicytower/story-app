import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { buildFolderZip, folderZipEntries, folderZipName } from "./export";

const chapter = (title: string, content = `${title} body`) => ({
  title,
  content,
  notes: `${title} notes`,
  createdAt: "2026-10-01T08:00:00.000Z",
  updatedAt: "2026-10-06T12:30:00.000Z",
});

const folder = {
  name: "Księga",
  notes: "Folder <!-- kept --> notes",
  createdAt: "2026-09-01T00:00:00.000Z",
  notesUpdatedAt: "2026-10-02T00:00:00.000Z",
  chapters: [chapter("Świt"), chapter("Noc"), chapter("Świt")],
};

function split(file: string) {
  const match = /^---\n([\s\S]*?)\n---\n\n([\s\S]*)$/.exec(file);
  if (!match) throw new Error("No frontmatter");
  return { data: parse(match[1]) as Record<string, unknown>, body: match[2] };
}

describe("folderZipEntries", () => {
  it("numbers chapters in folder order and adds notes.md", () => {
    expect(Object.keys(folderZipEntries(folder))).toEqual([
      "01-swit.md",
      "02-noc.md",
      "03-swit.md",
      "notes.md",
    ]);
  });

  it("writes every chapter with the single-story frontmatter", () => {
    const entries = folderZipEntries(folder);
    expect(split(entries["02-noc.md"])).toEqual({
      data: {
        title: "Noc",
        createdAt: "2026-10-01T08:00:00.000Z",
        updatedAt: "2026-10-06T12:30:00.000Z",
        notes: "Noc notes",
      },
      body: "Noc body",
    });
  });

  it("writes the folder notes with the folder name and dates", () => {
    expect(split(folderZipEntries(folder)["notes.md"])).toEqual({
      data: {
        title: "Księga",
        createdAt: "2026-09-01T00:00:00.000Z",
        updatedAt: "2026-10-02T00:00:00.000Z",
      },
      body: "Folder <!-- kept --> notes",
    });
  });

  it("pads numbers to the chapter count and falls back for empty slugs", () => {
    const many = {
      ...folder,
      chapters: Array.from({ length: 100 }, (_, i) => chapter(`C${i}`)),
    };
    const names = Object.keys(folderZipEntries(many));
    expect(names[0]).toBe("001-c0.md");
    expect(names[99]).toBe("100-c99.md");
    expect(
      Object.keys(folderZipEntries({ ...folder, chapters: [chapter("???")] })),
    ).toEqual(["01-chapter.md", "notes.md"]);
  });
});

describe("buildFolderZip", () => {
  it("produces a zip that fflate reads back", () => {
    const files = unzipSync(buildFolderZip(folder));
    const expected = folderZipEntries(folder);
    expect(Object.keys(files)).toEqual(Object.keys(expected));
    for (const [name, data] of Object.entries(files)) {
      expect(strFromU8(data)).toBe(expected[name]);
    }
  });
});

describe("folderZipName", () => {
  it("uses the safe folder name", () => {
    expect(folderZipName("Zażółć gęślą")).toBe("zazolc-gesla.zip");
    expect(folderZipName("!!!")).toBe("folder.zip");
  });
});
