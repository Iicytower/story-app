import { Node } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    comment: {
      insertComment: () => ReturnType;
    };
  }
}

const COMMENT = /^<!--([\s\S]*?)-->[ \t]*(?:\n|$)/;

// Author's note kept in the markdown as an HTML comment: public pages and the
// shared folder drop it with stripComments, the export keeps it.
export const Comment = Node.create({
  name: "comment",
  group: "block",
  content: "text*",
  marks: "",
  // Enter adds a newline inside the comment, as in a code block.
  code: true,
  defining: true,

  parseHTML() {
    return [{ tag: "aside[data-comment]", preserveWhitespace: "full" }];
  },

  renderHTML() {
    return [
      "aside",
      {
        "data-comment": "",
        "aria-label": "Comment",
        class:
          "my-2 whitespace-pre-wrap rounded-md border-l-4 border-amber-400 bg-amber-100/60 px-3 py-1 text-sm italic dark:bg-amber-500/15",
      },
      0,
    ];
  },

  markdownTokenizer: {
    name: "comment",
    level: "block",
    // Only at the start of a line, so "<!--" inside a paragraph does not split it.
    start: (src) => {
      const match = /(^|\n)<!--/.exec(src);
      return match ? match.index + match[1].length : -1;
    },
    tokenize: (src) => {
      const match = COMMENT.exec(src);
      if (!match) return undefined;
      return { type: "comment", raw: match[0], text: match[1].trim() };
    },
  },

  parseMarkdown: (token, helpers) =>
    helpers.createNode(
      "comment",
      {},
      token.text ? [{ type: "text", text: token.text }] : [],
    ),

  // "-->" inside the text would end the comment early and leak the rest to readers.
  renderMarkdown: (node) => {
    const text = (node.content ?? [])
      .map((child: { text?: string }) => child.text ?? "")
      .join("")
      .replaceAll("-->", "- ->");
    return `<!-- ${text} -->`;
  },

  addCommands() {
    return {
      // Inserted after the current top-level block (or in place of an empty one), with the cursor inside.
      insertComment:
        () =>
        ({ chain, state }) => {
          const { $from } = state.selection;
          const block = $from.depth === 0 ? null : $from.node(1);
          const replace = block?.isTextblock && block.content.size === 0;
          const from =
            $from.depth === 0
              ? $from.pos
              : replace
                ? $from.before(1)
                : $from.after(1);
          const to = replace ? $from.after(1) : from;
          // A paragraph after a comment at the end keeps a place to type outside it.
          const atEnd = to === state.doc.content.size;
          return chain()
            .insertContentAt(
              { from, to },
              atEnd
                ? [{ type: this.name }, { type: "paragraph" }]
                : [{ type: this.name }],
            )
            .setTextSelection(from + 1)
            .run();
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      // Enter on an empty last line leaves the comment, like exitOnDoubleEnter in code blocks.
      Enter: ({ editor }) => {
        const { $from, empty } = editor.state.selection;
        if (!empty || $from.parent.type !== this.type) return false;
        const atEnd = $from.parentOffset === $from.parent.content.size;
        if (!atEnd || !$from.parent.textContent.endsWith("\n")) return false;
        return editor
          .chain()
          .command(({ tr }) => {
            tr.delete($from.pos - 1, $from.pos);
            return true;
          })
          .exitCode()
          .run();
      },
    };
  },
});
