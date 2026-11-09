import { toolsJson, ToolsError, type ToolsConfig } from "@/lib/tools/client";
import { parseClassification, type Classification } from "./covers";

const CLASSIFY_TIMEOUT_MS = 15_000;

export async function classifyCover(
  config: ToolsConfig,
  bytes: Buffer,
): Promise<Classification> {
  const result = parseClassification(
    await toolsJson(config, "/classify", {
      method: "POST",
      body: new Uint8Array(bytes),
      timeoutMs: CLASSIFY_TIMEOUT_MS,
    }),
  );
  if (!result) throw new ToolsError("UNAVAILABLE");
  return result;
}
