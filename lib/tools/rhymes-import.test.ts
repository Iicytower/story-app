import { describe, expect, it } from "vitest";
import {
  decodeMsgpack,
  formFlags,
  FUNCTION_WORD,
  GRAMMATICAL,
  PARTS_OF_SPEECH,
  partsOfSpeech,
  VERBAL,
  wordFrequencies,
} from "./rhymes-import";

const bytes = (...values: (number | string)[]) =>
  new Uint8Array(
    values.flatMap((value) =>
      typeof value === "string"
        ? [...new TextEncoder().encode(value)]
        : [value],
    ),
  );

// fixstr of a short word.
const word = (text: string) => {
  const encoded = new TextEncoder().encode(text);
  return [0xa0 | encoded.length, ...encoded];
};

describe("decodeMsgpack", () => {
  it("reads the types wordfreq's files use", () => {
    expect(
      decodeMsgpack(
        bytes(
          0x95, // array of 5
          0x81, // map of 1
          ...word("format"),
          ...word("cB"),
          0xcd,
          0x01,
          0x00, // uint16 256
          0xff, // -1
          0xc0, // nil
          0xdc,
          0x00,
          0x02, // array16 of 2
          ...word("kot"),
          // str8 of 5 bytes ("ż" takes two).
          0xd9,
          0x05,
          "żaba",
        ),
      ),
    ).toEqual([{ format: "cB" }, 256, -1, null, ["kot", "żaba"]]);
  });

  it.each([
    ["a cut-off file", bytes(0x92, 0x01)],
    ["trailing data", bytes(0x01, 0x02)],
    ["an unknown type", bytes(0xc1)],
    ["broken UTF-8", bytes(0xa1, 0xff)],
  ])("refuses %s", (_, data) => {
    expect(() => decodeMsgpack(data)).toThrow();
  });
});

describe("wordFrequencies", () => {
  it("gives the Zipf frequency times 100 by bucket", () => {
    const data = bytes(
      0x94,
      0x81,
      ...word("format"),
      ...word("cB"),
      0x90, // bucket 0: none
      0x92,
      ...word("nie"),
      ...word("się"),
      0x91,
      ...word("kot"),
    );
    expect(wordFrequencies(data)).toEqual(
      new Map([
        ["nie", 899],
        ["się", 899],
        ["kot", 898],
      ]),
    );
  });

  it("refuses a file of another format", () => {
    expect(() =>
      wordFrequencies(bytes(0x91, 0x81, ...word("format"), ...word("x"))),
    ).toThrow("not a cB file");
  });
});

describe("formFlags", () => {
  it.each([
    // Criterion 4: words of an open ending like these go after the others.
    [
      "nie",
      ["interj", "part", "conj", "ppron3:sg:acc:n:ter:akc.nakc:praep"],
      FUNCTION_WORD,
    ],
    ["że", ["part:wok", "comp"], FUNCTION_WORD],
    ["się", ["part"], FUNCTION_WORD],
    ["pod", ["prep:acc:nwok", "prep:inst:nwok"], FUNCTION_WORD],
    ["tak", ["interj", "part", "adv", "subst:sg:nom:n:ncol"], FUNCTION_WORD],
    // A pronoun reading is enough ("mnie" is also a form of "miąć").
    ["mnie", ["ppron12:sg:gen:m1:pri:akc", "fin:sg:ter:perf"], FUNCTION_WORD],
    // Another reading of a content word keeps it.
    ["bomba", ["interj", "subst:sg:nom:f"], 0],
    ["koło", ["part", "prep:gen", "subst:sg:nom:n:ncol"], 0],
    ["pięknie", ["adv:pos"], 0],
    // Criterion 5: only gerund and participle readings, or one of them.
    ["czytanie", ["ger:sg:nom.acc:n:imperf:aff"], GRAMMATICAL | VERBAL],
    [
      "czytanego",
      ["ppas:sg:gen:m1:imperf:aff", "pact:sg:gen:m1:imperf:aff"],
      GRAMMATICAL | VERBAL,
    ],
    [
      "kochanie",
      ["ger:sg:nom.acc:n:imperf:aff", "subst:sg:nom.acc.voc:n:ncol"],
      VERBAL,
    ],
    ["kot", ["subst:sg:nom:m2"], 0],
  ])("%s → %i", (form, tags, flags) => {
    expect(formFlags(form, tags)).toBe(flags);
  });
});

describe("partsOfSpeech", () => {
  const { noun, adjective, verb, adverb, other } = PARTS_OF_SPEECH;
  it.each([
    ["kot", ["subst:sg:nom:m2"], noun],
    ["czytanie", ["ger:sg:nom.acc:n:imperf:aff"], noun],
    ["zielony", ["adj:sg:nom:m1:pos"], adjective],
    ["czytany", ["ppas:sg:nom:m1:imperf:aff"], adjective],
    ["czytający", ["pact:sg:nom:m1:imperf:aff"], adjective],
    ["czytam", ["fin:sg:pri:imperf"], verb],
    ["czytając", ["pcon:imperf"], verb],
    ["czytano", ["imps:imperf"], verb],
    ["pięknie", ["adv:pos"], adverb],
    ["abonująco", ["pacta"], adverb],
    ["pięć", ["num:pl:nom:m2:rec"], other],
    ["polsku", ["adjp"], other],
    ["trzeba", ["pred"], other],
    // Every reading counts.
    ["koło", ["part", "prep:gen", "subst:sg:nom:n:ncol"], noun | other],
    ["mnie", ["ppron12:sg:gen:m1:pri:akc", "fin:sg:ter:perf"], verb | other],
  ])("%s → %i", (_, tags, bits) => {
    expect(partsOfSpeech(tags)).toBe(bits);
  });

  it("maps every class of the PoliMorf tags", () => {
    // SELECT DISTINCT first segment FROM tags of the form table.
    const classes: Record<string, number> = {
      subst: noun,
      depr: noun,
      ger: noun,
      adj: adjective,
      adjc: adjective,
      pact: adjective,
      ppas: adjective,
      fin: verb,
      bedzie: verb,
      praet: verb,
      impt: verb,
      inf: verb,
      imps: verb,
      cond: verb,
      winien: verb,
      pcon: verb,
      pant: verb,
      adv: adverb,
      pacta: adverb,
      adja: other,
      adjp: other,
      num: other,
      numcomp: other,
      ppron12: other,
      ppron3: other,
      prep: other,
      conj: other,
      comp: other,
      part: other,
      interj: other,
      brev: other,
      frag: other,
      pred: other,
      aglt: other,
    };
    for (const [name, bits] of Object.entries(classes)) {
      expect(partsOfSpeech([`${name}:x`]), name).toBe(bits);
    }
  });
});
