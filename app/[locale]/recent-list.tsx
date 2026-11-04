"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChapterItem, type ChapterItemProps } from "./chapter-item";

const STEP = 5;

export function RecentList({
  chapters,
  label,
  showMore,
}: {
  chapters: ChapterItemProps[];
  label: string;
  showMore: string;
}) {
  const [shown, setShown] = useState(STEP);
  return (
    <>
      <ul
        aria-label={label}
        className="flex flex-col divide-y rounded-lg border"
      >
        {chapters.slice(0, shown).map((chapter) => (
          <ChapterItem key={chapter.path} {...chapter} />
        ))}
      </ul>
      {shown < chapters.length && (
        <Button
          variant="outline"
          className="self-center"
          onClick={() => setShown(shown + STEP)}
        >
          {showMore}
        </Button>
      )}
    </>
  );
}
