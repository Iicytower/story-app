import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SocialMarkdown } from "./social-markdown";

const render = (content: string) =>
  renderToStaticMarkup(<SocialMarkdown content={content} />);

describe("SocialMarkdown", () => {
  it("renders paragraphs, emphasis, quotes and line breaks", () => {
    const html = render("**bold** and *italic*\nnext line\n\n> quoted");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>italic</em>");
    expect(html).toContain("<br/>");
    expect(html).toContain("<blockquote>");
  });

  it("drops raw HTML", () => {
    const html = render('<script>alert(1)</script>\n\n<b onclick="x">hi</b>');
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<b");
    expect(html).not.toContain("onclick");
  });

  it("renders neither images nor headings, keeping the heading text", () => {
    const html = render("# Title\n\n![alt](https://example.com/a.png)");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<h1");
    expect(html).not.toContain("example.com");
    expect(html).toContain("Title");
  });

  it("unwraps other markdown such as lists and code", () => {
    const html = render("- item\n\n`code`");
    expect(html).not.toMatch(/<(ul|li|code)/);
    expect(html).toContain("item");
    expect(html).toContain("code");
  });

  it("opens links in a new tab without passing ranking or the opener", () => {
    const html = render("[site](https://example.com)");
    expect(html).toContain(
      '<a href="https://example.com" rel="nofollow ugc noopener" target="_blank">site</a>',
    );
  });

  it("drops javascript: links", () => {
    expect(render("[x](javascript:alert(1))")).not.toContain("javascript:");
  });
});
