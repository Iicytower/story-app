import Markdown, { type Components } from "react-markdown";
import remarkBreaks from "remark-breaks";

// D80: comments, posts, messages and bios. Never rehype-raw.
const ALLOWED_ELEMENTS = ["p", "strong", "em", "a", "blockquote", "br"];

const COMPONENTS: Components = {
  a: ({ href, children }) => (
    <a href={href} rel="nofollow ugc noopener" target="_blank">
      {children}
    </a>
  ),
};

export function SocialMarkdown({ content }: { content: string }) {
  return (
    <div className="prose dark:prose-invert max-w-none">
      <Markdown
        remarkPlugins={[remarkBreaks]}
        allowedElements={ALLOWED_ELEMENTS}
        unwrapDisallowed
        skipHtml
        components={COMPONENTS}
      >
        {content}
      </Markdown>
    </div>
  );
}
