import type { AnyExtension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Comment } from "./comment";

const ALLOWED_PROTOCOLS = ["http:", "https:", "mailto:"];

export function isAllowedLink(url: string): boolean {
  try {
    return ALLOWED_PROTOCOLS.includes(new URL(url).protocol);
  } catch {
    return false;
  }
}

// Shared by the editor and the markdown tests, which run without a DOM.
export const contentExtensions: AnyExtension[] = [
  StarterKit.configure({
    code: false,
    codeBlock: false,
    strike: false,
    underline: false,
    heading: { levels: [1, 2, 3] },
    link: {
      openOnClick: false,
      autolink: false,
      isAllowedUri: (url) => isAllowedLink(url),
    },
  }),
  Comment,
];

// A single newline in the source is a line break, as remark-breaks renders it on public pages.
export const MARKED_OPTIONS = { breaks: true, gfm: true };

// StarterKit's trailing node keeps an empty paragraph after a final comment or list,
// which would otherwise add blank lines to the saved markdown.
export function trimMarkdown(markdown: string): string {
  return markdown.replace(/\n+$/, "");
}
