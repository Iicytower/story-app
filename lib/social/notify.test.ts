import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import {
  GROUPED_TYPES,
  groupOf,
  isOptionalType,
  NOTIFICATION_TYPES,
  objectKey,
  OPTIONAL_NOTIFICATION_TYPES,
} from "./notifications";
import { chunks, notificationFields } from "./notify";

const id = () => new Types.ObjectId();

describe("objectKey", () => {
  it("keys by the most specific object", () => {
    const [comment, story, folder, user] = [id(), id(), id(), id()];
    expect(
      objectKey("reaction", {
        commentId: comment,
        storyIds: [story],
        folderId: folder,
      }),
    ).toBe(`reaction:comment:${comment.toString()}`);
    expect(objectKey("reaction", { storyIds: [story], folderId: folder })).toBe(
      `reaction:story:${story.toString()}`,
    );
    expect(objectKey("rating", { folderId: folder })).toBe(
      `rating:folder:${folder.toString()}`,
    );
    expect(objectKey("follower", { actorId: user })).toBe(
      `follower:user:${user.toString()}`,
    );
    expect(objectKey("ban", { actorId: id(), authorId: user })).toBe(
      `ban:user:${user.toString()}`,
    );
  });

  it("keys an admin-route report without the reporter", () => {
    expect(objectKey("report", { actorId: id() })).toBe("report:admin");
    const author = id();
    expect(objectKey("report", { actorId: id(), authorId: author })).toBe(
      `report:user:${author.toString()}`,
    );
  });

  it("keeps the reactions and ratings of one object apart from other objects and kinds", () => {
    const story = id();
    const keys = new Set([
      objectKey("reaction", { storyIds: [story] }),
      objectKey("rating", { storyIds: [story] }),
      objectKey("reaction", { storyIds: [id()] }),
      objectKey("reaction", { commentId: id(), storyIds: [story] }),
    ]);
    expect(keys.size).toBe(4);
  });
});

describe("notification kinds", () => {
  it("groups reactions and ratings only", () => {
    expect([...GROUPED_TYPES].sort()).toEqual(["rating", "reaction"]);
  });

  it("puts every kind in one of the four groups; only moderation has no switch", () => {
    expect(NOTIFICATION_TYPES.map(groupOf).every(Boolean)).toBe(true);
    expect(OPTIONAL_NOTIFICATION_TYPES).toEqual(
      NOTIFICATION_TYPES.filter(isOptionalType),
    );
    for (const type of NOTIFICATION_TYPES) {
      expect(isOptionalType(type)).toBe(groupOf(type) !== "moderation");
    }
    expect(groupOf("reply")).toBe("conversations");
    expect(groupOf("libraryChapter")).toBe("chapters");
    expect(groupOf("moderatorInvite")).toBe("moderation");
  });
});

describe("notificationFields", () => {
  it("stores the ids of the object and its group, without empty ones", () => {
    const [author, folder, story] = [id(), id(), id()];
    expect(
      notificationFields({
        type: "libraryChapter",
        actorId: author,
        authorId: author,
        folderId: folder.toString(),
        storyIds: [story],
      }),
    ).toEqual({
      type: "libraryChapter",
      group: "chapters",
      objectKey: `libraryChapter:story:${story.toString()}`,
      authorId: author,
      folderId: folder,
      storyIds: [story],
    });
    expect(notificationFields({ type: "follower", storyIds: [] })).toEqual({
      type: "follower",
      group: "interactions",
      objectKey: "follower:user:",
    });
  });
});

describe("chunks", () => {
  it("splits recipients in batches of 500", () => {
    const items = Array.from({ length: 1201 }, (_, i) => i);
    expect(chunks(items).map((batch) => batch.length)).toEqual([500, 500, 201]);
    expect(chunks([])).toEqual([]);
  });
});
