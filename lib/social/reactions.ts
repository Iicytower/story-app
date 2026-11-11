export const REACTIONS = [
  "heart",
  "laugh",
  "wow",
  "sad",
  "fire",
  "clap",
] as const;

export type ReactionKey = (typeof REACTIONS)[number];

export const REACTION_EMOJI: Record<ReactionKey, string> = {
  heart: "❤️",
  laugh: "😂",
  wow: "😮",
  sad: "😢",
  fire: "🔥",
  clap: "👏",
};

// A forum post (task 87) uses the same mechanism.
export const REACTION_TARGETS = ["story", "comment", "post"] as const;

export type ReactionTarget = (typeof REACTION_TARGETS)[number];

export const isReaction = (value: unknown): value is ReactionKey =>
  typeof value === "string" && (REACTIONS as readonly string[]).includes(value);

// Nicknames shown per reaction in the list; the rest is a number.
export const REACTORS_SHOWN = 50;

export const reactionsAnchor = "reactions";

export interface ReactionGroup {
  reaction: ReactionKey;
  count: number;
  nicknames: string[];
}

// Only reactions that someone gave, in REACTIONS order.
export interface ReactionSummary {
  groups: ReactionGroup[];
  mine: ReactionKey | null;
}

export const EMPTY_SUMMARY: ReactionSummary = { groups: [], mine: null };
