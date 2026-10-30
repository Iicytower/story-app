import { Extension, InputRule } from "@tiptap/core";
import Paragraph from "@tiptap/extension-paragraph";

const EN_DASH = "–";

// Runs before StarterKit's bullet list rule, which would turn "- " into a list.
export const DialogueDash = Extension.create({
  name: "dialogueDash",
  priority: 1000,

  addInputRules() {
    return [
      new InputRule({
        find: /^-\s$/,
        handler: ({ state, range }) => {
          state.tr.insertText(`${EN_DASH} `, range.from, range.to);
        },
      }),
    ];
  },
});

// A hyphen can still open a line (pasted text, undone input rule, after Shift+Enter)
// and would come back from the saved markdown as a list.
export const DialogueParagraph = Paragraph.extend({
  renderMarkdown(node, helpers, context) {
    return this.parent!(node, helpers, context).replace(/^- /gm, `${EN_DASH} `);
  },
});
