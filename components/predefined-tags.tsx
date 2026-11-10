"use client";

import { useLocale } from "next-intl";
import { createContext, useContext } from "react";
import type { Locale } from "@/i18n/routing";
import { labelOf, type PredefinedTagView } from "@/lib/tags/predefined";

const PredefinedTagsContext = createContext<PredefinedTagView[]>([]);

export function PredefinedTagsProvider({
  tags,
  children,
}: {
  tags: PredefinedTagView[];
  children: React.ReactNode;
}) {
  return (
    <PredefinedTagsContext.Provider value={tags}>
      {children}
    </PredefinedTagsContext.Provider>
  );
}

export function usePredefinedTags(): PredefinedTagView[] {
  return useContext(PredefinedTagsContext);
}

// The label in the current language for a predefined key, null for an own tag.
export function useTagLabel(): (tag: string) => string | null {
  const predefined = usePredefinedTags();
  const locale = useLocale() as Locale;
  return (tag) => labelOf(tag, predefined, locale);
}
