"use client";

import { useEffect } from "react";
import { saveReadingPosition } from "./actions";

const SAVE_EVERY_MS = 10_000;
// Within a few pixels of the bottom counts as the end, whatever the rounding of the browser.
const END_SLACK_PX = 4;

function scrolled(): number {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  if (window.scrollY >= max - END_SLACK_PX) return 1;
  return Math.round((Math.max(0, window.scrollY) / max) * 1000) / 1000;
}

// Saves where the reader is: every 10 seconds, when the tab is hidden and when the page is left
// inside the app. Losing the last seconds on closing the tab is accepted (no beforeunload).
export function ReadingTracker({
  storyId,
  resumeAt,
}: {
  storyId: string;
  resumeAt: number | null;
}) {
  useEffect(() => {
    if (resumeAt !== null) {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo({ top: resumeAt * max, behavior: "instant" });
    }
    let saved: number | null = null;
    // On leaving inside the app the next page is already in the document, so the last
    // position seen while scrolling is saved.
    let latest = scrolled();
    const save = (position = scrolled()) => {
      latest = position;
      if (position === saved) return;
      saved = position;
      // A failed save is retried by the next one; the reader is not interrupted.
      void saveReadingPosition(storyId, position).then(
        (result) => {
          if (result.ok) return;
          saved = null;
          // Unpublished or hidden meanwhile: further saves would be refused too.
          if (result.error === "NOT_FOUND") clearInterval(timer);
        },
        () => {
          saved = null;
        },
      );
    };
    // The end of the chapter is saved at once, so it counts as read without waiting.
    const onScroll = () => {
      latest = scrolled();
      if (latest === 1 && saved !== 1) save(latest);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") save();
    };
    const timer = setInterval(() => save(), SAVE_EVERY_MS);
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(timer);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVisibility);
      save(latest);
    };
  }, [storyId, resumeAt]);
  return null;
}
