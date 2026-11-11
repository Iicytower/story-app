import Markdown, { type Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import { UserLink } from "@/components/user-link";
import { MENTION } from "@/lib/social/mention-text";

// D80: comments, posts, messages and bios. Never rehype-raw.
const ALLOWED_ELEMENTS = ["p", "strong", "em", "a", "blockquote", "br"];

const COMPONENTS: Components = {
  a: ({ href, children, node }) => {
    const mention = node?.properties?.dataMention;
    if (typeof mention === "string") {
      return <UserLink nickname={mention}>{children}</UserLink>;
    }
    return (
      <a href={href} rel="nofollow ugc noopener" target="_blank">
        {children}
      </a>
    );
  },
};

// The parts of the mdast tree the plugin touches; links and code keep their text.
interface MdNode {
  type: string;
  value?: string;
  children?: MdNode[];
  url?: string;
  data?: { hProperties?: Record<string, string> };
}

const SKIPPED = new Set(["link", "linkReference", "inlineCode", "code"]);

function splitMentions(value: string, linked: Map<string, string>): MdNode[] {
  const parts: MdNode[] = [];
  let last = 0;
  for (const match of value.matchAll(MENTION)) {
    const nickname = linked.get(match[1].toLowerCase());
    if (!nickname) continue;
    if (match.index > last) {
      parts.push({ type: "text", value: value.slice(last, match.index) });
    }
    parts.push({
      type: "link",
      url: "",
      data: { hProperties: { dataMention: nickname } },
      children: [{ type: "text", value: match[0] }],
    });
    last = match.index + match[0].length;
  }
  if (last === 0) return [{ type: "text", value }];
  if (last < value.length)
    parts.push({ type: "text", value: value.slice(last) });
  return parts;
}

// Mentions resolved on the server (lib/social/mentions.ts) become profile links (task 82); any
// other @nick stays text.
function remarkMentions({ mentions }: { mentions: string[] }) {
  const linked = new Map(
    mentions.map((nickname) => [nickname.toLowerCase(), nickname]),
  );
  const walk = (node: MdNode) => {
    if (!node.children || SKIPPED.has(node.type)) return;
    node.children = node.children.flatMap((child) => {
      if (child.type === "text" && child.value) {
        return splitMentions(child.value, linked);
      }
      walk(child);
      return [child];
    });
  };
  return (tree: MdNode) => {
    if (linked.size > 0) walk(tree);
  };
}

export function SocialMarkdown({
  content,
  mentions = [],
}: {
  content: string;
  // Nicknames, in their own case, whose mentions link to the profile.
  mentions?: string[];
}) {
  return (
    <div className="prose dark:prose-invert max-w-none [overflow-wrap:anywhere]">
      <Markdown
        remarkPlugins={[remarkBreaks, [remarkMentions, { mentions }]]}
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

// The text alone, for an excerpt such as a quoted post (task 91): every element but paragraphs,
// breaks and list items keeps only its text, so formatting, links and quotes are dropped. A list
// item is a line of its own, without a marker.
export function PlainMarkdown({ content }: { content: string }) {
  return (
    <div className="flex flex-col gap-1 [overflow-wrap:anywhere]">
      <Markdown
        remarkPlugins={[remarkBreaks]}
        allowedElements={["p", "br", "li"]}
        components={{ li: ({ children }) => <p>{children}</p> }}
        unwrapDisallowed
        skipHtml
      >
        {content}
      </Markdown>
    </div>
  );
}
