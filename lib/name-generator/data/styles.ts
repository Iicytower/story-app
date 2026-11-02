import type { Style } from "../filters";
import { EN_DIGRAPHS, PL_DIGRAPHS } from "../phonemes";

export interface StyleTable {
  digraphs: string[];
  onsets: string[];
  nuclei: string[];
  codas: string[];
  male: string[];
  female: string[];
  neutral: string[];
  surname: string[];
  place: string[];
  thing: string[];
}

// Space-separated entries; "k*3" gives an entry weight 3.
const w = (entries: string): string[] =>
  entries.split(" ").flatMap((entry) => {
    const [text, weight] = entry.split("*");
    return Array<string>(Number(weight ?? 1)).fill(text);
  });

const table = (
  digraphs: string[],
  columns: Omit<StyleTable, "digraphs"> extends infer T
    ? { [K in keyof T]: string }
    : never,
): StyleTable => ({
  digraphs,
  onsets: w(columns.onsets),
  nuclei: w(columns.nuclei),
  codas: w(columns.codas),
  male: w(columns.male),
  female: w(columns.female),
  neutral: w(columns.neutral),
  surname: w(columns.surname),
  place: w(columns.place),
  thing: w(columns.thing),
});

export const STYLE_TABLES: Record<Style, StyleTable> = {
  polish: table(PL_DIGRAPHS, {
    onsets:
      "b*2 d*2 g*2 k*3 m*3 n*2 p*2 r*2 s*3 t*2 w*3 z*2 l*2 ł*2 j sz*2 cz*2 ż ś ch br dr gr kr pr tr st sk sw zb",
    nuclei: "a*5 e*4 i*3 o*5 u*2 y*2 ó ą ę ia ie",
    codas: "k*2 l*2 ł n*3 r*2 s t sz m ch ń j",
    male: "an*3 ek*2 ar ir omir sław usz ej ysław",
    female: "a*3 ka ina ena ia ysława",
    neutral: "o i e",
    surname: "ski*3 cki wicz*2 ak*2 ek czyk ik ała",
    place: "gród*2 bór wola ów ice owo sk in",
    thing: "nik ica ak ór ień",
  }),
  english: table(EN_DIGRAPHS, {
    onsets:
      "b*2 d*2 f*2 g h*2 j k l*3 m*3 n*2 p*2 r*3 s*3 t*3 w*3 th*2 sh ch br cr dr fl gr st tr",
    nuclei: "a*4 e*5 i*3 o*3 u ea ee oo",
    codas: "d*2 l*3 m n*4 r*3 s*2 t*2 th ck nd ld rd st",
    male: "ard*2 on*2 ert ley ric win",
    female: "a*2 ine ette ie ana ella",
    neutral: "y ey en is",
    surname: "son*3 ford*2 well ton*2 ley ham wood",
    place: "ton*3 ham*2 bury ford wick shire",
    thing: "er*2 ing ward bane",
  }),
  german: table(EN_DIGRAPHS, {
    onsets:
      "b*2 d*2 f*2 g*2 h*2 k*3 l*2 m*2 n r*2 s*2 t*2 w*3 sch*2 br dr gr kr tr st",
    nuclei: "a*4 e*4 i*2 o*3 u*2 ei*2 au ie",
    codas: "n*3 r*3 l*2 t*2 s k m ch*2 ld nd rt rg",
    male: "bert*2 hard*2 mund olf rich wald",
    female: "a*2 ina hild*2 gard lotte",
    neutral: "i el en",
    surname: "mann*3 berg*3 stein*2 bauer er feld",
    place: "burg*3 dorf*2 heim*2 stadt thal",
    thing: "ung*2 er*2 lich",
  }),
  nordic: table(EN_DIGRAPHS, {
    onsets:
      "b*2 d*2 f*2 g*2 h*3 k*2 l*2 m n r*2 s*3 t*2 v*3 y sk*2 st br gr sv tr",
    nuclei: "a*5 e*3 i*3 o*3 u*2 y ei au",
    codas: "n*3 r*4 l*2 k*2 f g d rn ld rk nd",
    male: "ar*2 ulf*2 geir*2 mund stein vald",
    female: "a*2 hild*2 dis run frid",
    neutral: "i e in",
    surname: "sen*3 son*3 dottir strom dahl",
    place: "heim*2 gard*3 vik*2 fjord borg",
    thing: "ir*2 nir ung",
  }),
  latin: table(EN_DIGRAPHS, {
    onsets: "b c*3 d*2 f g l*2 m*3 n*2 p*2 qu r*2 s*3 t*3 v*3 cl cr pr tr st",
    nuclei: "a*5 e*3 i*4 o*2 u*3 ae au",
    codas: "n*2 r*2 s*3 l*2 m*2 x t nt rt",
    male: "us*5 ius*3 anus or",
    female: "a*4 ia*3 ina ella",
    neutral: "is*2 ix en",
    surname: "ius*3 anus*2 ensis ellus",
    place: "ium*3 ia*3 polis ona",
    thing: "um*2 ax ator",
  }),
  celtic: table(EN_DIGRAPHS, {
    onsets: "b*2 c*2 d*3 f*2 g*2 k l*3 m*3 n*2 r*3 s*2 t*2 br*2 cr dr gw*2 bl",
    nuclei: "a*4 e*3 i*3 o*2 u*2 ai*2 ia ae ea",
    codas: "n*4 r*3 l*2 d*2 g th m dd nn",
    male: "an*3 wyn*2 ric ach dan",
    female: "a*2 wen*3 een ith enn",
    neutral: "in*2 y ey",
    surname: "an*2 gan*3 ach ell rick",
    place: "dun*2 mor*3 glen*2 caer lin",
    thing: "ach*2 enn all",
  }),
  elvish: table(EN_DIGRAPHS, {
    onsets: "f*2 h*2 l*5 m*2 n*4 r*2 s*4 th*3 v*3 y fl gl sil",
    nuclei: "a*4 e*5 i*5 o*2 ae*3 ia ie ea",
    codas: "l*4 n*5 r*3 s*2 th*2 nd",
    male: "ion*3 or*2 ir*2 as ael",
    female: "iel*4 wen*3 ara ia*2 ella",
    neutral: "il*2 ae en",
    surname: "ar*2 ien*2 thil lorn orin",
    place: "lin*2 ost*2 thien mar",
    thing: "ion*2 eth iel",
  }),
  dwarven: table(EN_DIGRAPHS, {
    onsets: "b*4 d*4 g*4 k*4 t*3 r*2 m th*2 dr*2 gr*3 kr*2 br*3 thr",
    nuclei: "a*4 o*4 u*4 i*2 e",
    codas: "k*3 r*3 n*2 m*2 d*3 g*2 rn*2 nd rk*2 rd",
    male: "in*3 ur*3 ak*2 or*2 grim",
    female: "a*2 is*2 un*2 ild",
    neutral: "im*2 ek",
    surname: "grund*2 hammer axe*2 forge beard",
    place: "dur*3 grad*2 khaz dum heim",
    thing: "grim*2 dur rak",
  }),
  orcish: table(EN_DIGRAPHS, {
    onsets: "b*3 d*3 g*5 k*4 r*2 t*2 z*3 m sh*2 kh*2 gr*4 kr*3 zg*2 dr br",
    nuclei: "a*4 o*3 u*5 i",
    codas: "k*4 g*4 r*4 z*3 t*2 sh rg*2 rk*2 zg",
    male: "ug*3 ak*2 ok*2 uk*2 urz",
    female: "a*2 ga*3 ka*2 usha",
    neutral: "ug*2 ok",
    surname: "gash*3 tusk*2 skull ruk",
    place: "gor*3 dush*2 krag*2 buz",
    thing: "grok*2 mak rak",
  }),
  scifi: table(EN_DIGRAPHS, {
    onsets: "d k*4 l*2 m*2 n*2 r*3 s*3 t*3 v*4 x*3 z*4 kr tr vr zy",
    nuclei: "a*4 e*4 i*3 o*3 y*2 u",
    codas: "x*4 k*2 n*3 r*3 s*2 th z t",
    male: "on*3 ex*3 ax*2 or",
    female: "a*3 ia*2 yra ix",
    neutral: "is*2 ix*2 os",
    surname: "ron*2 tek*3 dyne vance",
    place: "ion*2 ara*2 os prime",
    thing: "tron*3 ium*2 core",
  }),
};

const RARE_SHARED = "zgr mkt pfl vzd ngr ktr lmn nfr mzl fsk".split(" ");

export const RARE_CLUSTERS: string[] = RARE_SHARED;

// Clusters any style may contain; a table's own onsets and codas are added to these.
export const COMMON_CLUSTERS =
  "st sk sp tr kr pr br dr gr nd nt rd rk rt ld lt mb rm rn ns ls".split(" ");
