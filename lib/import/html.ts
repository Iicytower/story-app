import TurndownService from "turndown";

const service = new TurndownService({
  headingStyle: "atx",
  hr: "***",
  bulletListMarker: "-",
  emDelimiter: "*",
  // Line breaks are plain newlines in the app's markdown (D20).
  br: "",
});
service.remove(["title", "script", "style"]);
// A rule, because remove() ranks below the built-in image rule.
service.addRule("image", { filter: "img", replacement: () => "" });

export function htmlToMarkdown(html: string): string {
  return (
    service
      .turndown(html)
      // Dialogue is written with a dash (D28); escaped, "- " stays as a visible backslash.
      .replace(/^\\- /gm, "– ")
      .replace(/^\\\* \\\* \\\*$/gm, "***")
  );
}
