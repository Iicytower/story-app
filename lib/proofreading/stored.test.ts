import { getSchema } from "@tiptap/core";
import { MarkdownManager } from "@tiptap/markdown";
import type { Node } from "@tiptap/pm/model";
import { describe, expect, it } from "vitest";
import {
  contentExtensions,
  MARKED_OPTIONS,
  trimMarkdown,
} from "@/lib/editor/extensions";
import type { Proposal } from "./proposals";
import {
  MAX_PROPOSALS,
  parseStoredProofreading,
  restoreProofreading,
  type StoredProofreading,
  storableIssues,
  storeProofreading,
} from "./stored";

const manager = new MarkdownManager({
  extensions: contentExtensions,
  markedOptions: MARKED_OPTIONS,
});
const schema = getSchema(contentExtensions);
const docOf = (markdown: string) =>
  schema.nodeFromJSON(manager.parse(markdown));
// What the editor saves: its own serialization of the document.
const saved = (doc: Node) => trimMarkdown(manager.serialize(doc.toJSON()));

// A proposal on the nth occurrence of `word` in the document's text.
function proposalOn(doc: Node, word: string, id: number, nth = 0): Proposal {
  const found: number[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name === "comment") return false;
    if (!node.isText) return true;
    let index = node.text!.indexOf(word);
    while (index >= 0) {
      found.push(pos + index);
      index = node.text!.indexOf(word, index + 1);
    }
    return true;
  });
  const from = found[nth];
  return {
    id,
    from,
    to: from + word.length,
    original: word,
    issue: {
      kind: "spelling",
      message: `About ${word}`,
      replacements: [`${word}!`, `${word}?`],
      ruleId: "TEST",
    },
    choice: id % 2,
  };
}

const MD = [
  "# Napewno tytuł",
  "",
  "<!-- Napewno komentarz -->",
  "",
  "- Wogóle lista",
  "- druga \\*gwiazdka\\* Napewno",
  "",
  "Akapit &amp; Napewno tu.",
].join("\n");

const texts = (doc: Node, proposals: Proposal[]) =>
  proposals.map(({ from, to }) => doc.textBetween(from, to));

describe("stored proofreading", () => {
  it("survives saving the markdown and reading it again", () => {
    const doc = docOf(MD);
    const proposals = [
      proposalOn(doc, "Napewno", 0),
      proposalOn(doc, "Wogóle", 1),
      proposalOn(doc, "Napewno", 2, 1),
      proposalOn(doc, "Napewno", 3, 2),
    ];
    const stored = storeProofreading(doc, proposals, 2)!;
    // Through JSON, as in the database.
    const back = JSON.parse(JSON.stringify(stored)) as StoredProofreading;
    const reread = docOf(saved(doc));
    const restored = restoreProofreading(reread, back);
    expect(texts(reread, restored.proposals)).toEqual([
      "Napewno",
      "Wogóle",
      "Napewno",
      "Napewno",
    ]);
    expect(restored.proposals.map(({ choice }) => choice)).toEqual([
      0, 1, 0, 1,
    ]);
    expect(restored.proposals[1].issue).toEqual(proposals[1].issue);
    expect(restored.selected).toBe(restored.proposals[2].id);
  });

  it("finds a proposal moved by a little and drops one whose text is gone", () => {
    const doc = docOf("Ala Napewno ma Wogóle kota.");
    const stored = storeProofreading(
      doc,
      [proposalOn(doc, "Napewno", 0), proposalOn(doc, "Wogóle", 1)],
      1,
    )!;
    const changed = docOf("Wtedy Ala Napewno ma W ogóle kota.");
    const restored = restoreProofreading(changed, stored);
    expect(texts(changed, restored.proposals)).toEqual(["Napewno"]);
    // The current one is gone: the first left becomes current.
    expect(restored.selected).toBe(restored.proposals[0].id);
  });

  it("does not take text split between paragraphs", () => {
    const doc = docOf("Napewno tak.");
    const stored = storeProofreading(doc, [proposalOn(doc, "Napewno", 0)], 0)!;
    const changed = docOf("Napew\n\nno tak.");
    expect(restoreProofreading(changed, stored).proposals).toEqual([]);
  });

  it("stores nothing without proposals", () => {
    expect(storeProofreading(docOf("Ala."), [], null)).toBeNull();
  });

  it("keeps only what saveStory accepts, with the current one counted among the kept", () => {
    const words = Array.from({ length: MAX_PROPOSALS + 5 }, (_, i) => `w${i}`);
    const doc = docOf(words.join(" "));
    const all = words.map((word, id) => proposalOn(doc, word, id));
    // Too long for the database: the first and the second.
    all[0].issue = { ...all[0].issue, message: "x".repeat(1001) };
    all[1].issue = { ...all[1].issue, replacements: ["y".repeat(201)] };
    const stored = storeProofreading(doc, all, 3)!;
    const parsed = parseStoredProofreading(JSON.parse(JSON.stringify(stored)));
    expect(parsed).not.toBe("invalid");
    expect(stored.proposals).toHaveLength(MAX_PROPOSALS);
    expect(stored.proposals[stored.selected].original).toBe("w3");
    // The same limits apply when the issues are placed.
    expect(
      storableIssues(
        all.map((item) => ({
          ...item,
          issue: { ...item.issue, offset: 0, length: 0 },
        })),
      ),
    ).toHaveLength(MAX_PROPOSALS);
  });
});

describe("parseStoredProofreading", () => {
  const item = {
    at: 0,
    original: "Napewno",
    kind: "spelling",
    message: "",
    replacements: ["Na pewno"],
    ruleId: "X",
    choice: 0,
  };

  it("takes a valid state and null", () => {
    expect(parseStoredProofreading({ proposals: [item], selected: 0 })).toEqual(
      { proposals: [item], selected: 0 },
    );
    expect(parseStoredProofreading(null)).toBeNull();
  });

  it.each([
    ["no proposals", { proposals: [], selected: 0 }],
    ["a selected index out of range", { proposals: [item], selected: 1 }],
    ["an unknown kind", { proposals: [{ ...item, kind: "x" }], selected: 0 }],
    [
      "an empty original",
      { proposals: [{ ...item, original: "" }], selected: 0 },
    ],
    [
      "a choice past the suggestions",
      { proposals: [{ ...item, choice: 1 }], selected: 0 },
    ],
    ["a negative offset", { proposals: [{ ...item, at: -1 }], selected: 0 }],
    [
      "a long message",
      { proposals: [{ ...item, message: "x".repeat(1001) }], selected: 0 },
    ],
    [
      "too many proposals",
      { proposals: Array(MAX_PROPOSALS + 1).fill(item), selected: 0 },
    ],
    ["a string", "x"],
  ])("refuses %s", (_, value) => {
    expect(parseStoredProofreading(value)).toBe("invalid");
  });

  it("drops fields it does not know", () => {
    expect(
      parseStoredProofreading({
        proposals: [{ ...item, offset: 3, extra: true }],
        selected: 0,
      }),
    ).toEqual({ proposals: [item], selected: 0 });
  });
});
