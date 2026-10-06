export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

// Counts code points so that characters outside the BMP (e.g. emoji) count as one.
export function countCharacters(text: string): number {
  return Array.from(text).length;
}

// Typical pace of reading aloud.
const READ_ALOUD_WORDS_PER_MINUTE = 150;

export function formatReadAloudTime(words: number): string {
  const minutes = Math.ceil(words / READ_ALOUD_WORDS_PER_MINUTE);
  return minutes === 1 ? "1 minute" : `${minutes} minutes`;
}
