import { toolsJson, ToolsError, type ToolsConfig } from "@/lib/tools/client";
import {
  COVER_SIZE,
  parseClassification,
  type Classification,
  type ImageSize,
} from "./covers";

const CLASSIFY_TIMEOUT_MS = 15_000;

export async function classifyCover(
  config: ToolsConfig,
  bytes: Buffer,
  size: ImageSize = COVER_SIZE,
): Promise<Classification> {
  // Covers keep the bare path, which the classifier deployed before task 70 also accepts.
  const path =
    size.width === COVER_SIZE.width && size.height === COVER_SIZE.height
      ? "/classify"
      : `/classify?size=${size.width}x${size.height}`;
  const result = parseClassification(
    await toolsJson(config, path, {
      method: "POST",
      body: new Uint8Array(bytes),
      timeoutMs: CLASSIFY_TIMEOUT_MS,
    }),
  );
  if (!result) throw new ToolsError("UNAVAILABLE");
  return result;
}
