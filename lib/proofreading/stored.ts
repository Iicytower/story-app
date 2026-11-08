import type { Node } from "@tiptap/pm/model";
import type { IssueKind } from "./languagetool";
import { type DocIssue, docText } from "./map";
import type { Proposal } from "./proposals";

// The proofreading kept with the chapter (task 55). A proposal's place is an offset in the
// document's text (text nodes, comments left out), which does not depend on the block structure
// that reading the saved markdown again may change.
export interface StoredProposal {
  at: number;
  original: string;
  kind: IssueKind;
  message: string;
  replacements: string[];
  ruleId: string;
  choice: number;
}

export interface StoredProofreading {
  proposals: StoredProposal[];
  // Index of the current proposal.
  selected: number;
}

// With the request limit of Server Actions (4 MB) in mind: a full state stays far below it.
export const MAX_PROPOSALS = 1000;
const MAX_ORIGINAL = 200;
const MAX_MESSAGE = 1000;
const MAX_REPLACEMENTS = 8;
const MAX_RULE_ID = 100;
const KINDS = new Set<string>([
  "spelling",
  "grammar",
  "punctuation",
  "style",
  "other",
]);
// How far from its offset a proposal's text is looked for when it is not there.
const SEARCH_WINDOW = 100;

const fits = ({
  original,
  issue,
}: Pick<Proposal, "original" | "issue">) =>
  original.length > 0 &&
  original.length <= MAX_ORIGINAL &&
  issue.message.length <= MAX_MESSAGE &&
  issue.ruleId.length <= MAX_RULE_ID &&
  issue.replacements.length <= MAX_REPLACEMENTS &&
  issue.replacements.every((text) => text.length <= MAX_ORIGINAL);

// The placed issues the chapter can keep, so what is shown is what gets saved.
export const storableIssues = (issues: DocIssue[]) =>
  issues.filter(fits).slice(0, MAX_PROPOSALS);

export function storeProofreading(
  doc: Node,
  proposals: Proposal[],
  selected: number | null,
): StoredProofreading | null {
  if (proposals.length === 0) return null;
  const { positions } = docText(doc);
  const index = new Map(positions.map((position, at) => [position, at]));
  const stored: StoredProposal[] = [];
  let current = 0;
  for (const proposal of proposals) {
    const at = index.get(proposal.from);
    if (at === undefined || !fits(proposal)) continue;
    if (stored.length === MAX_PROPOSALS) break;
    if (proposal.id === selected) current = stored.length;
    const { kind, message, replacements, ruleId } = proposal.issue;
    stored.push({
      at,
      original: proposal.original,
      kind,
      message,
      replacements,
      ruleId,
      choice: proposal.choice,
    });
  }
  return stored.length > 0 ? { proposals: stored, selected: current } : null;
}

// Where a stored proposal's text is in the document: at its offset, or the nearest
// occurrence within the window, as one run of text.
function locate(
  text: string,
  positions: number[],
  { at, original }: StoredProposal,
): number | null {
  const fits = (start: number) => {
    if (text.slice(start, start + original.length) !== original) return false;
    for (let i = 1; i < original.length; i++)
      if (positions[start + i] !== positions[start] + i) return false;
    return true;
  };
  for (let distance = 0; distance <= SEARCH_WINDOW; distance++) {
    if (fits(at - distance)) return at - distance;
    if (distance > 0 && fits(at + distance)) return at + distance;
  }
  return null;
}

// The proposals that still fit the document; the current one stays current if it does.
export function restoreProofreading(
  doc: Node,
  stored: StoredProofreading,
): { proposals: Proposal[]; selected: number | null } {
  const { text, positions } = docText(doc);
  const proposals: Proposal[] = [];
  let selected: number | null = null;
  stored.proposals.forEach((item, index) => {
    const start = locate(text, positions, item);
    if (start === null || start < 0) return;
    const from = positions[start];
    const last = proposals.at(-1);
    if (last && from < last.to) return;
    const { original, kind, message, replacements, ruleId, choice } = item;
    proposals.push({
      id: index,
      from,
      to: from + original.length,
      original,
      issue: { kind, message, replacements, ruleId },
      choice,
    });
    if (index === stored.selected) selected = index;
  });
  return { proposals, selected: selected ?? proposals[0]?.id ?? null };
}

const isText = (value: unknown, max: number, min = 0) =>
  typeof value === "string" && value.length >= min && value.length <= max;

function parseProposal(value: unknown): StoredProposal | null {
  if (typeof value !== "object" || value === null) return null;
  const item = value as Record<string, unknown>;
  const { at, original, kind, message, replacements, ruleId, choice } = item;
  if (
    !Number.isSafeInteger(at) ||
    (at as number) < 0 ||
    !isText(original, MAX_ORIGINAL, 1) ||
    typeof kind !== "string" ||
    !KINDS.has(kind) ||
    !isText(message, MAX_MESSAGE) ||
    !isText(ruleId, MAX_RULE_ID) ||
    !Array.isArray(replacements) ||
    replacements.length > MAX_REPLACEMENTS ||
    !replacements.every((text) => isText(text, MAX_ORIGINAL)) ||
    !Number.isSafeInteger(choice) ||
    (choice as number) < 0 ||
    (choice as number) >= Math.max(replacements.length, 1)
  )
    return null;
  return {
    at: at as number,
    original: original as string,
    kind: kind as IssueKind,
    message: message as string,
    replacements: replacements as string[],
    ruleId: ruleId as string,
    choice: choice as number,
  };
}

// Client input of saveStory: null clears the proofreading, "invalid" refuses the save.
export function parseStoredProofreading(
  value: unknown,
): StoredProofreading | null | "invalid" {
  if (value === null) return null;
  if (typeof value !== "object") return "invalid";
  const { proposals, selected } = value as Record<string, unknown>;
  if (
    !Array.isArray(proposals) ||
    proposals.length === 0 ||
    proposals.length > MAX_PROPOSALS ||
    !Number.isSafeInteger(selected) ||
    (selected as number) < 0 ||
    (selected as number) >= proposals.length
  )
    return "invalid";
  const parsed = proposals.map(parseProposal);
  if (parsed.some((item) => item === null)) return "invalid";
  return {
    proposals: parsed as StoredProposal[],
    selected: selected as number,
  };
}
