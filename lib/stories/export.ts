type ExportedStory = {
  title: string;
  content: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

// JSON strings are valid YAML double-quoted scalars, except for characters YAML
// treats as non-printable or as line breaks, which JSON leaves unescaped.
function quote(value: string): string {
  return JSON.stringify(value).replace(
    /[\u007f-\u009f\u2028\u2029\ufeff\ufffe\uffff]/g,
    (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
}

export function withFrontmatter(
  fields: Record<string, string>,
  content: string,
): string {
  const frontmatter = Object.entries(fields)
    .map(([key, value]) => `${key}: ${quote(value)}`)
    .join("\n");
  return `---\n${frontmatter}\n---\n\n${content}`;
}

export function toMarkdownExport(story: ExportedStory): string {
  return withFrontmatter(
    {
      title: story.title,
      createdAt: story.createdAt,
      updatedAt: story.updatedAt,
      notes: story.notes,
    },
    story.content,
  );
}

const POLISH: Record<string, string> = {
  ą: "a",
  ć: "c",
  ę: "e",
  ł: "l",
  ń: "n",
  ó: "o",
  ś: "s",
  ź: "z",
  ż: "z",
};

export function exportFileName(title: string): string {
  return `${safeFileName(title, "story")}.md`;
}

export function safeFileName(text: string, fallback: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, (char) => POLISH[char])
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100)
    .replace(/-+$/, "");
  return slug || fallback;
}
