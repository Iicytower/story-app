import { closeHistory } from "@tiptap/pm/history";
import type { Node } from "@tiptap/pm/model";
import type { Transaction } from "@tiptap/pm/state";

// Replaces only the changed span, so the selection, scroll and untouched blocks stay, and
// the closed history group makes it one Undo (as replaceInDoc, D35). Null when nothing changed.
export function replaceDoc(tr: Transaction, next: Node): Transaction | null {
  const current = tr.doc;
  const start = current.content.findDiffStart(next.content);
  if (start === null) return null;
  let { a: endA, b: endB } = current.content.findDiffEnd(next.content)!;
  // The end search runs back past the start when the change repeats nearby text.
  const overlap = start - Math.min(endA, endB);
  if (overlap > 0) {
    endA += overlap;
    endB += overlap;
  }
  return closeHistory(tr.replace(start, endA, next.slice(start, endB)));
}

// The span of `current` to replace with `text` to get `next`, for a textarea edit.
export function textChange(current: string, next: string) {
  if (current === next) return null;
  let from = 0;
  const shorter = Math.min(current.length, next.length);
  while (from < shorter && current[from] === next[from]) from++;
  let end = 0;
  while (
    end < shorter - from &&
    current[current.length - 1 - end] === next[next.length - 1 - end]
  )
    end++;
  return {
    from,
    to: current.length - end,
    text: next.slice(from, next.length - end),
  };
}
