import { languageToolCode, type FolderLanguage } from "@/lib/languages";
import { toolsJson, type ToolsConfig } from "@/lib/tools/client";
import { annotateMarkdown } from "./annotate";

// 6000 words took 18–23 s warm on 1 CPU in the Coolify test and 8 s locally (task 29); D58.
export const PROOFREAD_TIMEOUT_MS = 120_000;

// Repetition within a sentence is off by default in LT and always on here (task 23).
export const ENABLED_RULES = ["PL_WORD_REPEAT"];

// Chosen in task 23 after trying real chapters.
export const DISABLED_RULES: string[] = [];

export type IssueKind =
  "spelling" | "grammar" | "punctuation" | "style" | "other";

// Independent of LT's response format; offsets count UTF-16 units of the markdown source.
export interface ProofreadIssue {
  offset: number;
  length: number;
  kind: IssueKind;
  message: string;
  replacements: string[];
  ruleId: string;
}

// LT offers hundreds of replacements for some typos; the dialog shows a short list.
const MAX_REPLACEMENTS = 8;

interface LtMatch {
  message: string;
  offset: number;
  length: number;
  replacements?: { value?: string }[];
  rule?: { id?: string; issueType?: string; category?: { id?: string } };
}

const KIND_BY_CATEGORY: Record<string, IssueKind> = {
  TYPOS: "spelling",
  SPELLING: "spelling",
  PUNCTUATION: "punctuation",
  TYPOGRAPHY: "punctuation",
  GRAMMAR: "grammar",
  STYLE: "style",
  REDUNDANCY: "style",
  REPETITIONS: "style",
  REPETITIONS_STYLE: "style",
};

const KIND_BY_ISSUE_TYPE: Record<string, IssueKind> = {
  misspelling: "spelling",
  typographical: "punctuation",
  grammar: "grammar",
  style: "style",
  register: "style",
  duplication: "style",
};

export function issueKind(rule: LtMatch["rule"]): IssueKind {
  return (
    KIND_BY_CATEGORY[rule?.category?.id ?? ""] ??
    KIND_BY_ISSUE_TYPE[rule?.issueType ?? ""] ??
    "other"
  );
}

export function mapMatches(response: unknown): ProofreadIssue[] {
  const matches = (response as { matches?: unknown } | null)?.matches;
  if (!Array.isArray(matches)) return [];
  // A match without a position cannot be shown; the action must not throw on it.
  return (matches as LtMatch[])
    .filter(
      (match) =>
        Number.isInteger(match?.offset) && Number.isInteger(match?.length),
    )
    .map((match) => ({
      offset: match.offset,
      length: match.length,
      kind: issueKind(match.rule),
      message: String(match.message ?? ""),
      replacements: (match.replacements ?? [])
        .map(({ value }) => value)
        .filter((value): value is string => typeof value === "string")
        .slice(0, MAX_REPLACEMENTS),
      ruleId: match.rule?.id ?? "",
    }));
}

export function checkRequestBody(
  markdown: string,
  language: FolderLanguage,
): URLSearchParams {
  const body = new URLSearchParams({
    data: JSON.stringify({ annotation: annotateMarkdown(markdown) }),
    language: languageToolCode(language),
    enabledRules: ENABLED_RULES.join(","),
  });
  if (DISABLED_RULES.length) {
    body.set("disabledRules", DISABLED_RULES.join(","));
  }
  return body;
}

// Throws ToolsError when the server is down, answers with an error or takes too long.
export async function proofread(
  config: ToolsConfig,
  markdown: string,
  language: FolderLanguage,
): Promise<ProofreadIssue[]> {
  const response = await toolsJson(config, "/lt/v2/check", {
    method: "POST",
    body: checkRequestBody(markdown, language),
    timeoutMs: PROOFREAD_TIMEOUT_MS,
  });
  return mapMatches(response);
}
