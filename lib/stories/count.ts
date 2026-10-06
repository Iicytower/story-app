export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

// Counts code points so that characters outside the BMP (e.g. emoji) count as one.
export function countCharacters(text: string): number {
  return Array.from(text).length;
}
