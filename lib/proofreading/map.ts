import type { Node } from "@tiptap/pm/model";
import { diffChars } from "diff";
import { annotateMarkdown } from "./annotate";
import type { ProofreadIssue } from "./languagetool";

// An issue placed in the editor's document: from/to are ProseMirror positions.
export interface DocIssue {
  id: number;
  from: number;
  to: number;
  // The document text in the range when it was placed.
  original: string;
  issue: ProofreadIssue;
}

// Characters LT read as text, each with its offset in the markdown source.
function sourceText(markdown: string) {
  let text = "";
  const offsets: number[] = [];
  let offset = 0;
  for (const part of annotateMarkdown(markdown)) {
    if ("text" in part) {
      text += part.text;
      for (let i = 0; i < part.text.length; i++) offsets.push(offset + i);
    } else if (part.interpretAs?.length === 1) {
      // An escape: shown as its character, but markup, so no issue can cover it.
      text += part.interpretAs;
      offsets.push(-1);
    }
    offset += "text" in part ? part.text.length : part.markup.length;
  }
  return { text, offsets };
}

// Characters of the document's text nodes with their positions. Comments are not checked.
function docText(doc: Node) {
  let text = "";
  const positions: number[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name === "comment") return false;
    if (node.isText) {
      text += node.text;
      for (let i = 0; i < node.text!.length; i++) positions.push(pos + i);
    }
    return true;
  });
  return { text, positions };
}

const DIFF_TIMEOUT_MS = 500;

// Document position of each source offset that is text, or -1. The two texts differ only
// where the editor reads the markdown differently from the lexer (e.g. entities), so a
// character diff lines them up.
function sourceToDoc(markdown: string, doc: Node): Int32Array {
  const source = sourceText(markdown);
  const target = docText(doc);
  const map = new Int32Array(markdown.length).fill(-1);
  const link = (sourceIndex: number, docIndex: number) => {
    const offset = source.offsets[sourceIndex];
    if (offset >= 0) map[offset] = target.positions[docIndex];
  };
  if (source.text === target.text) {
    source.offsets.forEach((_, index) => link(index, index));
    return map;
  }
  // Text the lexer and the editor read very differently (e.g. tables) makes the diff long;
  // past the limit no issue is placed rather than freezing the page.
  const changes = diffChars(source.text, target.text, {
    timeout: DIFF_TIMEOUT_MS,
  });
  if (!changes) return map;
  let sourceIndex = 0;
  let docIndex = 0;
  for (const change of changes) {
    const count = change.value.length;
    if (change.added) docIndex += count;
    else if (change.removed) sourceIndex += count;
    else for (let i = 0; i < count; i++) link(sourceIndex++, docIndex++);
  }
  return map;
}

// Keeps issues that cover only text, in one run of the document, and do not overlap an
// earlier one. An issue touching markdown syntax is dropped, as replacing it would break
// the markup (task 23).
export function placeIssues(
  markdown: string,
  doc: Node,
  issues: ProofreadIssue[],
): DocIssue[] {
  const map = sourceToDoc(markdown, doc);
  const placed: DocIssue[] = [];
  for (const issue of issues.toSorted((a, b) => a.offset - b.offset)) {
    const { offset, length } = issue;
    if (length <= 0 || offset < 0 || offset + length > markdown.length)
      continue;
    const from = map[offset];
    let contiguous = from >= 0;
    for (let i = 1; contiguous && i < length; i++)
      contiguous = map[offset + i] === from + i;
    if (!contiguous) continue;
    const last = placed.at(-1);
    if (last && from < last.to) continue;
    const to = from + length;
    placed.push({
      id: placed.length,
      from,
      to,
      original: doc.textBetween(from, to),
      issue,
    });
  }
  return placed;
}
