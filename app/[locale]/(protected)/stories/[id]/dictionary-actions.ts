"use server";

import type { ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import { actionError } from "@/lib/i18n/action-error";
import { toolsConfig, type ToolsConfig, ToolsError } from "@/lib/tools/client";
import { type Definitions, findDefinitions } from "@/lib/tools/definitions";
import { findSynonyms, type Synonyms } from "@/lib/tools/synonyms";
import {
  findLemmas,
  parseLookupWord,
  type Lemma,
} from "@/lib/tools/dictionary";

// Lookups are Server Actions though they write nothing (D61): the word goes in the POST body,
// not in a URL that ends up in logs. An unknown word gives an empty list.
async function lookUp<T>(
  value: unknown,
  find: (config: ToolsConfig, word: string) => Promise<T>,
): Promise<ActionResult<{ word: string } & T>> {
  const user = await requireUser();
  if (!user.ok) return user;
  const config = toolsConfig();
  if (!config) return actionError("TOOL_UNAVAILABLE", "toolUnavailable");
  const word = parseLookupWord(value);
  if (word === null) return actionError("INVALID_INPUT", "lookupWordInvalid");

  try {
    return { ok: true, word, ...(await find(config, word)) };
  } catch (error) {
    if (!(error instanceof ToolsError)) throw error;
    return error.failure === "TIMEOUT"
      ? actionError("TIMEOUT", "dictionaryTimeout")
      : actionError("TOOL_UNAVAILABLE", "toolUnavailable");
  }
}

export async function lookUpLemmas(
  value: unknown,
): Promise<ActionResult<{ word: string; lemmas: Lemma[] }>> {
  return lookUp(value, async (config, word) => ({
    lemmas: await findLemmas(config, word),
  }));
}

// The Definitions tile (task 32): every lemma of the word with its senses.
export async function lookUpDefinitions(
  value: unknown,
): Promise<ActionResult<{ word: string } & Definitions>> {
  return lookUp(value, findDefinitions);
}

// The Synonyms tile (task 33): every lemma of the word with its synonyms from each source.
export async function lookUpSynonyms(
  value: unknown,
): Promise<ActionResult<{ word: string } & Synonyms>> {
  return lookUp(value, findSynonyms);
}
