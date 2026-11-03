import { getTranslations } from "next-intl/server";
import type {
  ActionError,
  ErrorCode,
  ValidationError,
} from "@/lib/action-result";
import type { ErrorKey, ErrorValues } from "./messages";

// Server Action messages are in the language of the request (D46).
export async function actionError(
  error: ErrorCode,
  key: ErrorKey,
  values?: ErrorValues,
): Promise<ActionError> {
  const t = await getTranslations("errors");
  return { ok: false, error, message: t(key, values) };
}

export function translateError({ error, key, values }: ValidationError) {
  return actionError(error, key, values);
}
