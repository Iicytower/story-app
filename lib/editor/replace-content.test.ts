import { getSchema } from "@tiptap/core";
import { history, undo } from "@tiptap/pm/history";
import { MarkdownManager } from "@tiptap/markdown";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { describe, expect, it } from "vitest";
import { contentExtensions, MARKED_OPTIONS } from "./extensions";
import { replaceDoc, textChange } from "./replace-content";

const manager = new MarkdownManager({
  extensions: contentExtensions,
  markedOptions: MARKED_OPTIONS,
});
const schema = getSchema(contentExtensions);
const docOf = (markdown: string) =>
  schema.nodeFromJSON(manager.parse(markdown));
const markdownOf = (state: EditorState) =>
  manager.serialize(state.doc.toJSON());

describe("replaceDoc", () => {
  it.each([
    ["a word", "Ala ma kota.\n\nDrugi akapit.", "Ala ma psa.\n\nDrugi akapit."],
    ["formatted text", "To **jest** *tu*.", "To **był** *tu*."],
    ["a repeated letter", "Kot kot.", "Kot kott."],
    ["several blocks", "# A\n\nb\n\nc", "# A\n\nB\n\nC i D"],
  ])("changes %s and Undo brings the old text back", (_, before, after) => {
    let state = EditorState.create({
      doc: docOf(before),
      plugins: [history()],
    });
    // Typed just before: without the closed group, one Undo would also take this back.
    state = state.apply(state.tr.insertText("X", state.doc.content.size - 1));
    const typed = markdownOf(state);
    state = state.apply(replaceDoc(state.tr, docOf(after))!);
    expect(markdownOf(state)).toBe(after);
    undo(state, (tr) => (state = state.apply(tr)));
    expect(markdownOf(state)).toBe(typed);
  });

  it("does nothing when the documents are equal", () => {
    const state = EditorState.create({ doc: docOf("Ala") });
    expect(replaceDoc(state.tr, docOf("Ala"))).toBeNull();
  });

  it("keeps the selection outside the changed span", () => {
    let state = EditorState.create({ doc: docOf("Ala ma kota.\n\nKoniec") });
    const end = state.doc.content.size - 1;
    state = state.apply(
      state.tr.setSelection(TextSelection.near(state.doc.resolve(end))),
    );
    state = state.apply(replaceDoc(state.tr, docOf("Ala ma psa.\n\nKoniec"))!);
    expect(
      state.doc.textBetween(state.selection.from - 6, state.selection.from),
    ).toBe("Koniec");
  });
});

describe("textChange", () => {
  it.each([
    ["Ala ma kota", "Ala ma psa", { from: 7, to: 10, text: "ps" }],
    ["kot kot", "kot kott", { from: 7, to: 7, text: "t" }],
    ["abc", "", { from: 0, to: 3, text: "" }],
    ["", "abc", { from: 0, to: 0, text: "abc" }],
    ["aaa", "aa", { from: 2, to: 3, text: "" }],
  ])("%j → %j", (current, next, change) => {
    expect(textChange(current, next)).toEqual(change);
    const { from, to, text } = change;
    expect(current.slice(0, from) + text + current.slice(to)).toBe(next);
  });

  it("is null for the same text", () => {
    expect(textChange("a", "a")).toBeNull();
  });
});
