import {
  AudioLinesIcon,
  BookOpenIcon,
  type LucideIcon,
  ReplaceIcon,
  SparklesIcon,
  SpellCheckIcon,
} from "lucide-react";
import { type ComponentType, lazy } from "react";

export interface Tool {
  // Key of tools.items, with the label and description.
  id: "proofread" | "name-generator" | "definitions" | "synonyms" | "rhymes";
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

const Proofread = lazy(() =>
  import("./proofread").then((module) => ({ default: module.Proofread })),
);

const Definitions = lazy(() =>
  import("./definitions").then((module) => ({ default: module.Definitions })),
);

const Synonyms = lazy(() =>
  import("./synonyms").then((module) => ({ default: module.Synonyms })),
);

const Rhymes = lazy(() =>
  import("./rhymes").then((module) => ({ default: module.Rhymes })),
);

// A new tool adds its tile and view here.
export const TOOLS: Tool[] = [
  {
    id: "proofread",
    icon: SpellCheckIcon,
    View: Proofread,
    dialogClassName: "flex h-[calc(100dvh-2rem)] flex-col sm:max-w-6xl",
  },
  {
    id: "name-generator",
    icon: SparklesIcon,
    View: NameGenerator,
    dialogClassName: "max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-4xl",
  },
  {
    id: "definitions",
    icon: BookOpenIcon,
    View: Definitions,
    dialogClassName: "max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl",
  },
  {
    id: "synonyms",
    icon: ReplaceIcon,
    View: Synonyms,
    dialogClassName: "max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl",
  },
  {
    id: "rhymes",
    icon: AudioLinesIcon,
    View: Rhymes,
    dialogClassName: "max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl",
  },
];
