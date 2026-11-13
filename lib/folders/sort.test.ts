import { describe, expect, it } from "vitest";
import { chapterOrder, folderOrder } from "./sort";

describe("chapterOrder", () => {
  it("puts the oldest chapter first in created, ties by the older id", () => {
    expect(chapterOrder("created")).toEqual({
      sort: { createdAt: 1, _id: 1 },
    });
  });

  it("orders manual by position and alpha by title with the Polish collation", () => {
    expect(chapterOrder("manual")).toEqual({ sort: { position: 1, _id: 1 } });
    expect(chapterOrder("alpha")).toEqual({
      sort: { title: 1, _id: 1 },
      collation: { locale: "pl", strength: 2 },
    });
  });
});

describe("folderOrder", () => {
  it("keeps the most recently active folder first in updated", () => {
    expect(folderOrder("updated")).toEqual({
      sort: { lastActivityAt: -1, _id: -1 },
    });
  });
});
