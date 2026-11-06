"use server";

import type { ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import { actionError } from "@/lib/i18n/action-error";
import { toolsConfig, ToolsError } from "@/lib/tools/client";
import {
  findLemmas,
  parseLookupWord,
  type Lemma,
} from "@/lib/tools/dictionary";

// A lookup is a Server Action though it writes nothing (D61): the word goes in the POST body,
// not in a URL that ends up in logs. An unknown word gives an empty list.
export async function lookUpLemmas(
  value: unknown,
): Promise<ActionResult<{ word: string; lemmas: Lemma[] }>> {
  const user = await requireUser();
  if (!user.ok) return user;
  const config = toolsConfig();
  if (!config) return actionError("TOOL_UNAVAILABLE", "toolUnavailable");
  const word = parseLookupWord(value);
  if (word === null) return actionError("INVALID_INPUT", "lookupWordInvalid");

  try {
    return { ok: true, word, lemmas: await findLemmas(config, word) };
  } catch (error) {
    if (!(error instanceof ToolsError)) throw error;
    return error.failure === "TIMEOUT"
      ? actionError("TIMEOUT", "dictionaryTimeout")
      : actionError("TOOL_UNAVAILABLE", "toolUnavailable");
  }
}
