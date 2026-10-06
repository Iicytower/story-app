import Markdown from "react-markdown";
import remarkBreaks from "remark-breaks";

export function MarkdownPreview({ content }: { content: string }) {
  return (
    <div className="prose dark:prose-invert max-w-none">
      {/* Without rehype-raw, react-markdown would render raw HTML (including
          <!-- comments -->) as text; skipHtml drops it entirely. */}
      <Markdown remarkPlugins={[remarkBreaks]} skipHtml>
        {content}
      </Markdown>
    </div>
  );
}
