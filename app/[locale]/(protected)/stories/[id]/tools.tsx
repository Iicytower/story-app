import {
  AudioLinesIcon,
  type LucideIcon,
  ReplaceIcon,
  SparklesIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { type ComponentType, lazy } from "react";

export interface Tool {
  // Key of tools.items, with the label and description.
  id: "name-generator" | "synonyms" | "rhymes";
  icon: LucideIcon;
  // Shown in the dialog the tile opens.
  View: ComponentType;
  dialogClassName?: string;
}

// Loaded on opening the tile: the generator and its word lists stay out of the editor bundle.
const NameGenerator = lazy(() =>
  import("./name-generator").then((module) => ({
    default: module.NameGenerator,
  })),
);

function ComingSoon() {
  const t = useTranslations("tools");
  return <p className="text-muted-foreground text-sm">{t("comingSoon")}</p>;
}

// A new tool adds its tile and view here. Placeholders until tasks 33 and 34.
export const TOOLS: Tool[] = [
  {
    id: "name-generator",
    icon: SparklesIcon,
    View: NameGenerator,
    dialogClassName: "max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-4xl",
  },
  {
    id: "synonyms",
    icon: ReplaceIcon,
    View: ComingSoon,
  },
  {
    id: "rhymes",
    icon: AudioLinesIcon,
    View: ComingSoon,
  },
];
