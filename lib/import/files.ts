import { unzipSync } from "fflate";
import { ImportError } from "./document";
import { MAX_UNPACKED_BYTES } from "./limits";

const TOO_LARGE = "The unpacked file is too large.";

export function assertUnpackedSize(
  bytes: Uint8Array,
  limit = MAX_UNPACKED_BYTES,
): void {
  let total = 0;
  unzipSync(bytes, {
    // Sizes come from the headers, so this rejects a zip bomb without unpacking it.
    filter: ({ originalSize }) => {
      total += originalSize;
      if (total > limit) throw new ImportError(TOO_LARGE);
      return false;
    },
  });
}

export function unzip(bytes: Uint8Array): Record<string, Uint8Array> {
  assertUnpackedSize(bytes);
  return unzipSync(bytes);
}

// Older Polish text files and FictionBooks are not UTF-8.
export function decodeText(bytes: Uint8Array): string {
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 200));
  const declared = /^<\?xml[^>]*encoding=["']([\w-]+)["']/.exec(head)?.[1];
  let text: string;
  try {
    text = new TextDecoder(declared ?? "utf-8", { fatal: true }).decode(bytes);
  } catch {
    text = new TextDecoder("windows-1250").decode(bytes);
  }
  return text.replace(/\r\n?/g, "\n");
}
