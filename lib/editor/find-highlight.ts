import { Extension } from "@tiptap/core";
import { closeHistory } from "@tiptap/pm/history";
import type { Node } from "@tiptap/pm/model";
import { Plugin, PluginKey, type Transaction } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import { expandMatch, findMatches, type Match } from "./find";

export const MATCH_CLASS = "rounded-xs bg-yellow-300/60 dark:bg-yellow-500/35";
export const CURRENT_MATCH_CLASS =
  "rounded-xs bg-orange-400/80 dark:bg-orange-500/70";

type DocMatch = Match & { block: string; start: number };

const key = new PluginKey<DecorationSet>("findHighlight");

export const FindHighlight = Extension.create({
  name: "findHighlight",
  addProseMirrorPlugins: () => [
    new Plugin<DecorationSet>({
      key,
      state: {
        init: () => DecorationSet.empty,
        apply: (tr, set) => tr.getMeta(key) ?? set.map(tr.mapping, tr.doc),
      },
      props: { decorations: (state) => key.getState(state) },
    }),
  ],
});

export function showMatches(
  view: EditorView,
  matches: Match[],
  current: number,
) {
  const decorations = matches.map(({ from, to }, index) =>
    Decoration.inline(
      from,
      to,
      index === current
        ? { class: CURRENT_MATCH_CLASS, "data-find-current": "" }
        : { class: MATCH_CLASS },
    ),
  );
  view.dispatch(
    view.state.tr.setMeta(
      key,
      DecorationSet.create(view.state.doc, decorations),
    ),
  );
}

// Searches each text block on its own. A line break counts as one "\n",
// so an offset in the block's text is also its offset in the document.
export function docMatches(doc: Node, regex: RegExp): DocMatch[] {
  const matches: DocMatch[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    const start = pos + 1;
    const block = node.textBetween(0, node.content.size, undefined, "\n");
    for (const { from, to } of findMatches(block, regex))
      matches.push({ from: start + from, to: start + to, block, start });
    return false;
  });
  return matches;
}

// Back to front, so earlier positions stay valid. The closed history group
// makes the whole replacement one Undo, even right after typing.
export function replaceInDoc(
  tr: Transaction,
  matches: DocMatch[],
  regex: RegExp,
  template: string,
): Transaction {
  for (const { from, to, block, start } of matches.toReversed()) {
    const text = expandMatch(
      block,
      { from: from - start, to: to - start },
      regex,
      template,
    );
    if (text)
      tr.replaceWith(
        from,
        to,
        // Takes the formatting of the replaced text.
        tr.doc.type.schema.text(text, tr.doc.nodeAt(from)?.marks),
      );
    else tr.delete(from, to);
  }
  return closeHistory(tr);
}
