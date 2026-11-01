"use client";

import { GlobeIcon, GlobeLockIcon } from "lucide-react";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { setChapterPublished } from "../../stories/actions";

export function PublishChapterButton({
  id,
  title,
  isPublic,
}: {
  id: string;
  title: string;
  isPublic: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const label = `${isPublic ? "Hide" : "Publish"} "${title}"`;

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await setChapterPublished(id, !isPublic);
        })
      }
    >
      {isPublic ? <GlobeIcon /> : <GlobeLockIcon />}
    </Button>
  );
}
