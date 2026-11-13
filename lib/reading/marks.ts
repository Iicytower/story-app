import type { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { MAX_MARKS_PER_CHAPTER } from "@/lib/limits";
import {
  ReaderMark,
  type ReaderMarkFields,
  type ReaderMarkKind,
} from "@/lib/models/reader-mark";

// The query a chapter page reads to scroll to a bookmark or note from the library.
export const MARK_PARAM = "mark";

export interface ReaderMarkView {
  id: string;
  kind: ReaderMarkKind;
  position: number;
  name: string;
  text: string;
  quote: string;
  prefix: string;
  suffix: string;
  createdAt: string;
  updatedAt: string;
}

export function toMarkView(
  mark: ReaderMarkFields & { _id: Types.ObjectId },
): ReaderMarkView {
  return {
    id: mark._id.toString(),
    kind: mark.kind,
    position: mark.position,
    name: mark.name ?? "",
    text: mark.text ?? "",
    quote: mark.quote ?? "",
    prefix: mark.prefix ?? "",
    suffix: mark.suffix ?? "",
    createdAt: mark.createdAt.toISOString(),
    updatedAt: mark.updatedAt.toISOString(),
  };
}

// Only the reader's own marks (D1): the chapter's author does not see them either.
export async function listChapterMarks(
  userId: string,
  storyId: string,
): Promise<ReaderMarkView[]> {
  await connectDB();
  const marks = await ReaderMark.find({ userId, storyId })
    .sort({ position: 1, _id: 1 })
    // Parallel saves may pass the limit by a few (task 74).
    .limit(MAX_MARKS_PER_CHAPTER * 2)
    .lean();
  return marks.map(toMarkView);
}
