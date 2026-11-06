import { describe, expect, it } from "vitest";
import { isVerbTag, rhymeKeys, syllableCount, transcribe } from "./rhyme-key";

const keys = (word: string, verb?: boolean) => rhymeKeys(word, verb)!;

describe("transcribe", () => {
  it.each([
    // Digraphs and letters (rules 1–2).
    ["szczur", "ščur"],
    ["dżem", "ʤem"],
    ["chleb", "xlep"],
    ["hak", "xak"],
    // i softens or is /j/ (rule 3).
    ["nie", "ńe"],
    ["dzieci", "ʥeći"],
    ["ziemia", "źemja"],
    ["historii", "xistorji"],
    ["kino", "kino"],
    // au and eu (rule 4).
    ["auto", "awto"],
    ["nauka", "nauka"],
    ["nieufny", "ńeufny"],
    ["muzeum", "muzeum"],
    ["Tadeusz", "tadeuš"],
    ["Mateusza", "mateuša"],
    // Nasals by the next phone (rule 5).
    ["sąd", "sont"],
    ["ząb", "zomp"],
    ["wziąć", "vźońć"],
    ["wziął", "vźow"],
    ["węch", "vęx"],
    ["idę", "ide"],
    ["idą", "idą"],
    // Voicing from the right; v and rz take it but do not pass it on (rule 6).
    ["krew", "kref"],
    ["wtorek", "ftorek"],
    ["twój", "tfuj"],
    ["trzy", "tšy"],
    ["prośba", "proźba"],
    ["łóżko", "wuško"],
    // Loanwords and rz read apart.
    ["mania", "mańja"],
    ["dumania", "dumańa"],
    ["pizza", "pica"],
    ["zamarzać", "zamarzać"],
    ["umarzać", "umažać"],
    ["marzenie", "mažeńe"],
  ])("%s → %s", (word, phones) => {
    expect(transcribe(word).join("")).toBe(phones);
  });
});

describe("rhymeKeys", () => {
  it.each([
    // The examples of the research.
    ["państwo", "aństfo"],
    ["łóżko", "uško"],
    ["kaszka", "aška"],
    ["trzy", "y"],
    ["twój", "uj"],
    ["mąka", "onka"],
    ["sąd", "ont"],
    ["historii", "orji"],
    ["auto", "awto"],
    ["nauka", "uka"],
    ["miałbym", "awbym"],
    // Stress (rule 7).
    ["chodzilibyśmy", "ilibyśmy"],
    ["czytaliśmy", "aliśmy"],
    ["czytałyście", "awyśće"],
    ["czytałaby", "awaby"],
    ["zrobiłbym", "iwbym"],
    ["chodziliby", "iliby"],
    ["żebyśmy", "ebyśmy"],
    ["gramatyka", "yka"],
    ["kot", "ot"],
  ])("the exact key of %s is %s", (word, exact) => {
    expect(keys(word).exact).toBe(exact);
  });

  it("moves the stress back only in a verb", () => {
    expect(keys("czytaliśmy", false).exact).toBe("iśmy");
    expect(keys("osłaby", false).exact).toBe("aby");
    expect(keys("osłaby", true).exact).toBe("oswaby");
  });

  it.each([
    // Criterion 1: known pairs at their level.
    ["kota", "złota", "exact"],
    ["woda", "szkoda", "exact"],
    ["miny", "przyczyny", "near"],
    ["ręce", "młodzieńce", "near"],
    ["kot", "rok", "near"],
    ["nóżki", "pończoszki", "last"],
    ["kot", "samolot", "last"],
  ])("%s and %s rhyme at the %s level", (a, b, level) => {
    const x = keys(a);
    const y = keys(b);
    const found =
      x.exact === y.exact
        ? "exact"
        : x.near === y.near
          ? "near"
          : x.last !== null && x.last === y.last
            ? "last"
            : "none";
    expect(found).toBe(level);
  });

  it("joins i and y, final ą and o, and consonants by class in the near key", () => {
    expect(keys("miny").near).toBe("yNy");
    expect(keys("idą").near).toBe(keys("ido").near);
    expect(keys("ręce").near).toBe("eNCe");
    // A run of one class counts once.
    expect(keys("państwo").near).toBe("aNFPFo");
  });

  it("takes the last syllable with the consonant before an open ending", () => {
    expect(keys("nóżki").last).toBe("ky");
    expect(keys("kot").last).toBe("ot");
    expect(keys("nie").last).toBe("ńe");
    // Criterion 4: an open ending without a consonant before it has no last syllable.
    expect(keys("idea").last).toBeNull();
    expect(keys("ul").last).toBe("ul");
  });

  it("has no keys without a vowel", () => {
    expect(rhymeKeys("w")).toBeNull();
    expect(rhymeKeys("pkt")).toBeNull();
  });

  it("reads a form as typed, whatever its case", () => {
    expect(keys("Kota")).toEqual(keys("kota"));
    expect(keys("KOTA")).toEqual(keys("kota"));
  });
});

describe("syllableCount", () => {
  it.each([
    ["kot", 1],
    ["nie", 1],
    ["ziemia", 2],
    ["historii", 3],
    ["auto", 2],
    ["nauka", 3],
    ["muzeum", 3],
    ["Tadeusz", 3],
    ["chodzilibyśmy", 5],
    ["zrobiłbym", 3],
    ["pies", 1],
    ["pkt", 0],
  ])("%s has %i", (word, count) => {
    expect(syllableCount(transcribe(word).join(""))).toBe(count);
  });
});

describe("isVerbTag", () => {
  it.each([
    ["cond:sg:m1.m2.m3:pri:imperf", true],
    ["praet:pl:m1:pri:imperf", true],
    ["adj:sg:nom:f:pos", false],
    ["fin:sg:ter:imperf", false],
  ])("%s → %s", (tag, verb) => {
    expect(isVerbTag(tag)).toBe(verb);
  });
});
