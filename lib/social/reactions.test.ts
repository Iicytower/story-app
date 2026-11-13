import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import pl from "@/messages/pl.json";
import { isReaction, REACTION_EMOJI, REACTIONS } from "./reactions";

describe("isReaction", () => {
  it("accepts the six keys", () => {
    for (const key of REACTIONS) expect(isReaction(key)).toBe(true);
  });

  it("rejects anything else", () => {
    for (const value of [
      "like",
      "Heart",
      "❤️",
      "",
      null,
      undefined,
      1,
      ["heart"],
      { reaction: "heart" },
      "constructor",
    ]) {
      expect(isReaction(value)).toBe(false);
    }
  });
});

describe("REACTIONS", () => {
  it("has an emoji and a label in both languages for each key", () => {
    for (const key of REACTIONS) {
      expect(REACTION_EMOJI[key]).toBeTruthy();
      expect(en.reactions.names[key]).toBeTruthy();
      expect(pl.reactions.names[key]).toBeTruthy();
    }
  });
});
