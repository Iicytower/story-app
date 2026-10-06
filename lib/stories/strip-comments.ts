const COMMENT = /<!--[\s\S]*?-->/g;

// Repeats until stable, because removing one comment can glue a new one together
// (`<!-<!-- -->- x -->`). Anything after a leftover `<!--` is dropped.
export function stripComments(text: string): string {
  let current = text;
  for (;;) {
    const next = current.replace(COMMENT, "");
    if (next === current) break;
    current = next;
  }
  const open = current.indexOf("<!--");
  return open === -1 ? current : current.slice(0, open);
}
