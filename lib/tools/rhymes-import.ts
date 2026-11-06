// Data of the rhyme database (task 34, D64): word frequencies from wordfreq and the kind of each
// form from its PoliMorf tags. Used by `dict:build rhymes`.

// The subset of MessagePack wordfreq's files use: arrays, maps, strings and small integers.
export function decodeMsgpack(data: Uint8Array): unknown {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const text = new TextDecoder("utf-8", { fatal: true });
  let at = 0;
  const string = (length: number) => {
    const value = text.decode(data.subarray(at, at + length));
    at += length;
    return value;
  };
  const array = (length: number) => Array.from({ length }, () => read());
  const map = (length: number) => {
    const value: Record<string, unknown> = {};
    for (let index = 0; index < length; index++) {
      const key = read();
      if (typeof key !== "string") throw new Error("msgpack: map key");
      value[key] = read();
    }
    return value;
  };
  const uint = (bytes: 1 | 2 | 4) => {
    const value =
      bytes === 1
        ? view.getUint8(at)
        : bytes === 2
          ? view.getUint16(at)
          : view.getUint32(at);
    at += bytes;
    return value;
  };
  function read(): unknown {
    if (at >= data.length) throw new Error("msgpack: unexpected end");
    const byte = data[at++];
    if (byte <= 0x7f) return byte;
    if (byte >= 0xe0) return byte - 0x100;
    if ((byte & 0xf0) === 0x80) return map(byte & 0x0f);
    if ((byte & 0xf0) === 0x90) return array(byte & 0x0f);
    if ((byte & 0xe0) === 0xa0) return string(byte & 0x1f);
    switch (byte) {
      case 0xc0:
        return null;
      case 0xc2:
        return false;
      case 0xc3:
        return true;
      case 0xcc:
        return uint(1);
      case 0xcd:
        return uint(2);
      case 0xce:
        return uint(4);
      case 0xd9:
        return string(uint(1));
      case 0xda:
        return string(uint(2));
      case 0xdb:
        return string(uint(4));
      case 0xdc:
        return array(uint(2));
      case 0xdd:
        return array(uint(4));
      case 0xde:
        return map(uint(2));
      case 0xdf:
        return map(uint(4));
    }
    throw new Error(`msgpack: type 0x${byte.toString(16)}`);
  }
  const value = read();
  if (at !== data.length) throw new Error("msgpack: trailing data");
  return value;
}

// wordfreq's "cB" format: a header, then lists of words by frequency, list n holding the words of
// frequency 10^(-n/100). The result is the Zipf frequency (log10 of uses per billion words) times
// 100: 900 for a word used every time, 300 for once in a million.
export function wordFrequencies(data: Uint8Array): Map<string, number> {
  const decoded = decodeMsgpack(data);
  if (
    !Array.isArray(decoded) ||
    (decoded[0] as { format?: unknown } | null)?.format !== "cB"
  ) {
    throw new Error("wordfreq: not a cB file.");
  }
  const frequencies = new Map<string, number>();
  decoded.slice(1).forEach((bucket: unknown, index) => {
    if (!Array.isArray(bucket)) throw new Error("wordfreq: bad bucket.");
    for (const word of bucket) {
      if (typeof word !== "string") throw new Error("wordfreq: bad word.");
      frequencies.set(word, 900 - index);
    }
  });
  return frequencies;
}

// Forms shown after the others (task 34): function words ("nie", "się", "że", "ale") have a
// conjunction or pronoun reading, or only particle-like readings; "bomba" or "koło" (also
// an interjection or a preposition) stay content words. Gerunds and participles ("czytanie",
// "czytanego") have only verbal readings; "kochanie" or "pytanie" have a noun reading too, so for
// them the app sees whether the query is verbal as well (VERBAL).
const FUNCTION_ANY = new Set([
  "conj",
  "comp",
  "ppron12",
  "ppron3",
  "siebie",
  "aglt",
]);
const FUNCTION_ALL = new Set(["prep", "part", "interj", "brev", "frag"]);
// Pronominal adverbs, which the tags do not tell from "pięknie".
const FUNCTION_FORMS = new Set([
  "tak",
  "tam",
  "tu",
  "tutaj",
  "też",
  "gdzie",
  "teraz",
  "wtedy",
  "zawsze",
  "nigdy",
  "bardzo",
]);
const VERBAL_CLASSES = new Set(["ger", "pact", "ppas", "pant", "pcon", "imps"]);

export const FUNCTION_WORD = 1;
export const GRAMMATICAL = 2;
export const VERBAL = 4;

export function formFlags(form: string, tags: string[]): number {
  const classes = tags.map((tag) => tag.split(":")[0]);
  const functionWord =
    FUNCTION_FORMS.has(form) ||
    classes.some((name) => FUNCTION_ANY.has(name)) ||
    classes.every((name) => FUNCTION_ALL.has(name));
  return (
    (functionWord ? FUNCTION_WORD : 0) |
    (classes.every((name) => VERBAL_CLASSES.has(name)) ? GRAMMATICAL : 0) |
    (classes.some((name) => VERBAL_CLASSES.has(name)) ? VERBAL : 0)
  );
}
