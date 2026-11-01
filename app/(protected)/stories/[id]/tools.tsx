import {
  AudioLinesIcon,
  type LucideIcon,
  ReplaceIcon,
  SparklesIcon,
} from "lucide-react";
import type { ComponentType } from "react";

export interface Tool {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  // Shown in the dialog the tile opens.
  View: ComponentType;
}

function ComingSoon() {
  return <p className="text-muted-foreground text-sm">Coming soon.</p>;
}

// A new tool adds its tile and view here. Placeholders until tasks 42, 33 and 34.
export const TOOLS: Tool[] = [
  {
    id: "name-generator",
    label: "Name generator",
    description: "Find names for characters and places.",
    icon: SparklesIcon,
    View: ComingSoon,
  },
  {
    id: "synonyms",
    label: "Synonyms",
    description: "Look up other words for a word.",
    icon: ReplaceIcon,
    View: ComingSoon,
  },
  {
    id: "rhymes",
    label: "Rhymes",
    description: "Look up words that rhyme.",
    icon: AudioLinesIcon,
    View: ComingSoon,
  },
];
