import { safeFileName } from "@/lib/stories/export";

// The number prefix keeps the folder order in a file manager and makes equal titles unique.
export function chapterFileName(
  title: string,
  index: number,
  total: number,
  extension: string,
): string {
  const digits = Math.max(2, String(total).length);
  const number = String(index + 1).padStart(digits, "0");
  return `${number}-${safeFileName(title, "chapter")}.${extension}`;
}
