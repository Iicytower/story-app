import { describe, expect, it } from "vitest";
import { anchorQuote, type QuoteAnchor } from "./anchor";

const BEFORE = "The storm came at night. ";
const QUOTE = "The old lighthouse keeper waited by the door";
const AFTER = ", listening to the waves below.";
const ORIGINAL = `Chapter one.\n\n${BEFORE}${QUOTE}${AFTER}\n\nMorning came slowly.`;

function noteOn(text: string, quote = QUOTE): QuoteAnchor {
  const start = text.indexOf(quote);
  const end = start + quote.length;
  return {
    quote,
    prefix: text.slice(Math.max(0, start - 50), start),
    suffix: text.slice(end, end + 50),
    position: start / text.length,
  };
}

const found = (text: string, anchor: QuoteAnchor) => {
  const span = anchorQuote(text, anchor);
  return span && text.slice(span.start, span.end);
};

describe("anchorQuote", () => {
  it("finds the passage where it was", () => {
    const span = anchorQuote(ORIGINAL, noteOn(ORIGINAL));
    expect(span).toEqual({
      start: ORIGINAL.indexOf(QUOTE),
      end: ORIGINAL.indexOf(QUOTE) + QUOTE.length,
    });
  });

  it("follows the passage moved by text added before it", () => {
    const anchor = noteOn(ORIGINAL);
    const moved = `${"A new opening paragraph. ".repeat(40)}\n\n${ORIGINAL}`;
    const span = anchorQuote(moved, anchor);
    expect(span?.start).toBe(moved.indexOf(QUOTE));
    expect(found(moved, anchor)).toBe(QUOTE);
  });

  it("finds the quote alone when its context changed", () => {
    const anchor = noteOn(ORIGINAL);
    const edited = ORIGINAL.replace(BEFORE, "Rain fell all evening. ").replace(
      AFTER,
      " and did not move.",
    );
    expect(found(edited, anchor)).toBe(QUOTE);
  });

  it("picks the repeated quote nearest to where the note was", () => {
    const text = `Yes. ${"Filler sentence here. ".repeat(20)}Yes. ${"More filler text. ".repeat(20)}Yes.`;
    const second = text.indexOf("Yes.", 10);
    const anchor = {
      quote: "Yes.",
      prefix: "changed context",
      suffix: "changed context",
      position: second / text.length,
    };
    expect(anchorQuote(text, anchor)?.start).toBe(second);
  });

  it("orphans a short quote whose only copies are far from where it was", () => {
    const filler = "Filler sentence here. ".repeat(100);
    const text = `Start. Yes. ${filler}Yes, later.`;
    const anchor = {
      quote: "Yes.",
      prefix: "Start. ",
      suffix: " Filler",
      position: 7 / text.length,
    };
    expect(found(text, anchor)).toBe("Yes.");
    // The author deleted it there; the copy 2000 characters later is another passage.
    const edited = `Start. No. ${filler}Yes.`;
    expect(anchorQuote(edited, anchor)).toBeNull();
    // A long quote is still found anywhere.
    const moved = `${"Added text. ".repeat(300)}${ORIGINAL.replace(BEFORE, "")}`;
    expect(found(moved, { ...noteOn(ORIGINAL), prefix: "x" })).toBe(QUOTE);
  });

  it("finds a passage whose quote the author changed slightly", () => {
    const anchor = noteOn(ORIGINAL);
    const changed = "The old lighthouse keeper waited at the door";
    expect(found(ORIGINAL.replace(QUOTE, changed), anchor)).toBe(changed);
  });

  it("finds a slightly changed quote moved far from its place", () => {
    const anchor = noteOn(ORIGINAL);
    const changed = "The old lighthouse-keeper waited by its door";
    const edited = `${"Added text. ".repeat(200)}${ORIGINAL.replace(QUOTE, changed)}`;
    expect(found(edited, anchor)).toBe(changed);
  });

  it("orphans a note whose passage was deleted", () => {
    const anchor = noteOn(ORIGINAL);
    expect(anchorQuote(ORIGINAL.replace(QUOTE, ""), anchor)).toBeNull();
  });

  it("orphans a note whose passage was rewritten", () => {
    const anchor = noteOn(ORIGINAL);
    const rewritten = ORIGINAL.replace(
      QUOTE,
      "Nobody stood at the entrance anymore",
    );
    expect(anchorQuote(rewritten, anchor)).toBeNull();
  });

  it("orphans a note in an empty text", () => {
    expect(anchorQuote("", noteOn(ORIGINAL))).toBeNull();
  });
});
