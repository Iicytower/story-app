import { getSchema } from "@tiptap/core";
import { MarkdownManager } from "@tiptap/markdown";
import { history, undo } from "@tiptap/pm/history";
import { EditorState, type Transaction } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { describe, expect, it } from "vitest";
import { contentExtensions, MARKED_OPTIONS } from "@/lib/editor/extensions";
import type { ProofreadIssue } from "./languagetool";
import { placeIssues } from "./map";
import {
  applyProposal,
  chooseSuggestion,
  currentProposal,
  dismissWord,
  loadProposals,
  proposalsPlugin,
  proposalsState,
  rejectProposal,
  selectProposal,
} from "./proposals";

const manager = new MarkdownManager({
  extensions: contentExtensions,
  markedOptions: MARKED_OPTIONS,
});
const schema = getSchema(contentExtensions);

function issue(
  markdown: string,
  word: string,
  replacements: string[],
): ProofreadIssue {
  return {
    offset: markdown.indexOf(word),
    length: word.length,
    kind: "spelling",
    message: "",
    replacements,
    ruleId: "TEST",
  };
}

const markdownOf = (view: EditorView) =>
  manager.serialize(view.state.doc.toJSON());

// The plugin's state without a DOM: dispatch applies the transaction, as EditorView does.
function setup(markdown: string, issues: ProofreadIssue[]) {
  const doc = schema.nodeFromJSON(manager.parse(markdown));
  const view = {
    state: EditorState.create({
      doc,
      // History as in the dialog's editor (StarterKit).
      plugins: [
        proposalsPlugin({ apply: "Apply", reject: "Reject" }),
        history(),
      ],
    }),
    dispatch(tr: Transaction) {
      view.state = view.state.apply(tr);
    },
  } as EditorView;
  loadProposals(view, placeIssues(markdown, doc, issues));
  return {
    view,
    markdown: () => manager.serialize(view.state.doc.toJSON()),
    left: () =>
      proposalsState(view.state).proposals.map(({ original }) => original),
    current: () => currentProposal(proposalsState(view.state))?.original,
  };
}

const MD = "Napewno **Wogóle** i tą książkę.";
const ISSUES = [
  issue(MD, "Napewno", ["Na pewno", "Napewnie"]),
  issue(MD, "Wogóle", ["W ogóle"]),
  issue(MD, "tą", []),
];

describe("proofread proposals", () => {
  it("applies the chosen suggestion and keeps the markdown formatting", () => {
    const { view, markdown, left } = setup(MD, ISSUES);
    applyProposal(view, 1);
    expect(markdown()).toBe("Napewno **W ogóle** i tą książkę.");
    chooseSuggestion(view, 0, 1);
    applyProposal(view, 0);
    expect(markdown()).toBe("Napewnie **W ogóle** i tą książkę.");
    expect(left()).toEqual(["tą"]);
  });

  it("leaves the text unchanged on reject and with no decision", () => {
    const { view, markdown, left } = setup(MD, ISSUES);
    rejectProposal(view, 0);
    expect(left()).toEqual(["Wogóle", "tą"]);
    expect(markdown()).toBe(MD);
  });

  it("cannot apply an issue without suggestions, only reject it", () => {
    const { view, markdown, left } = setup(MD, ISSUES);
    applyProposal(view, 2);
    expect(markdown()).toBe(MD);
    expect(left()).toContain("tą");
    rejectProposal(view, 2);
    expect(left()).not.toContain("tą");
  });

  it("moves to the next proposal after a decision on the current one", () => {
    const { view, current } = setup(MD, ISSUES);
    expect(current()).toBe("Napewno");
    selectProposal(view, 1);
    expect(current()).toBe("Wogóle");
    rejectProposal(view, 1);
    expect(current()).toBe("tą");
    selectProposal(view, 0);
    applyProposal(view, 0);
    expect(current()).toBe("tą");
    rejectProposal(view, 2);
    expect(current()).toBeUndefined();
  });

  it("dismisses every pending spelling proposal of a word added to the dictionary", () => {
    const md = "Kwak i kwak, KWAK. Kwak tu.";
    const [first, second, third, fourth] = [0, 7, 13, 19];
    const at = (offset: number, kind = "spelling" as const) => ({
      ...issue(md, "Kwak", []),
      offset,
      kind,
    });
    const { view, left, current } = setup(md, [
      at(first),
      at(second),
      at(third),
      { ...at(fourth), kind: "grammar" },
    ]);
    selectProposal(view, 0);
    dismissWord(view, "Kwak");
    // "kwak" is not "Kwak" in the dictionary's sense; grammar stays.
    expect(left()).toEqual(["kwak", "Kwak"]);
    expect(current()).toBe("kwak");
    expect(markdownOf(view)).toBe(md);
  });

  it("follows edits elsewhere and drops a proposal whose text was edited", () => {
    const { view, markdown, left } = setup(MD, ISSUES);
    view.dispatch(view.state.tr.insertText("Wtedy ", 1));
    view.dispatch(view.state.tr.insertText("x", 16));
    expect(left()).toEqual(["Napewno", "tą"]);
    applyProposal(view, 0);
    expect(markdown()).toBe("Wtedy Na pewno **Wxogóle** i tą książkę.");
  });

  it("keeps the proposals on Undo of the user's own typing", () => {
    const { view, left } = setup(MD, ISSUES);
    view.dispatch(view.state.tr.insertText("Wtedy ", 1));
    undo(view.state, view.dispatch);
    expect(left()).toEqual(["Napewno", "Wogóle", "tą"]);
  });
});
