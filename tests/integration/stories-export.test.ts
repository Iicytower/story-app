import { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { parse } from "yaml";
import { GET } from "@/app/(protected)/stories/[id]/export/route";
import { requireUser } from "@/lib/auth/session";
import { Story } from "@/lib/models/story";
import { setupTestDb } from "./test-db";

vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn() }));

setupTestDb();

const alice = new Types.ObjectId();
const bob = new Types.ObjectId();

function signInAs(userId: Types.ObjectId | null) {
  vi.mocked(requireUser).mockResolvedValue(
    userId
      ? { ok: true, userId: userId.toString() }
      : { ok: false, error: "UNAUTHORIZED", message: "Signed out" },
  );
}

beforeEach(() => signInAs(alice));

function exportStory(id: string) {
  return GET(new Request(`http://localhost/stories/${id}/export`), {
    params: Promise.resolve({ id }),
  });
}

describe("GET /stories/[id]/export", () => {
  it("returns the story as a markdown attachment with frontmatter", async () => {
    const story = await Story.create({
      userId: alice,
      title: "Zażółć: „gęślą” jaźń",
      content: "Visible <!-- hidden comment -->\nMore",
      notes: "Line one\nkey: value",
    });

    const response = await exportStory(story._id.toString());

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "text/markdown; charset=utf-8",
    );
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="zazolc-gesla-jazn.md"',
    );
    const [, frontmatter, body] = /^---\n([\s\S]*?)\n---\n\n([\s\S]*)$/.exec(
      await response.text(),
    )!;
    expect(parse(frontmatter)).toEqual({
      title: "Zażółć: „gęślą” jaźń",
      createdAt: story.createdAt.toISOString(),
      updatedAt: story.updatedAt.toISOString(),
      notes: "Line one\nkey: value",
    });
    expect(body).toBe("Visible <!-- hidden comment -->\nMore");
  });

  it("returns 401 without a session", async () => {
    const story = await Story.create({ userId: alice, title: "Mine" });
    signInAs(null);

    const response = await exportStory(story._id.toString());

    expect(response.status).toBe(401);
    expect(response.headers.get("Content-Disposition")).toBeNull();
  });

  it("returns 404 for another user's story", async () => {
    const story = await Story.create({ userId: bob, title: "Bob's" });
    expect((await exportStory(story._id.toString())).status).toBe(404);
  });

  it("returns 404 for a deleted story", async () => {
    const story = await Story.create({
      userId: alice,
      title: "Gone",
      deletedAt: new Date(),
    });
    expect((await exportStory(story._id.toString())).status).toBe(404);
  });

  it("returns 404 for an invalid or unknown id", async () => {
    expect((await exportStory("not-an-id")).status).toBe(404);
    expect((await exportStory(new Types.ObjectId().toString())).status).toBe(
      404,
    );
  });
});
