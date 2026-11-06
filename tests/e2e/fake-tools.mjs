// Stands in for the tools server (D56) in E2E: answers LanguageTool's /v2/check from a
// fixed list of words, so results do not depend on a running LT, and the dictionary service's
// /dict/lemmas from a small form table (task 25). Markers in the text or the looked-up word:
// AWARIA answers 503, POWOLI answers after a delay.
import { createServer } from "node:http";

const [port, secret] = process.argv.slice(2);

// Word → LT match fields (case-sensitive). An empty list is an issue without suggestions.
const ISSUES = {
  Napewno: {
    replacements: ["Na pewno", "Napewnie"],
    category: "TYPOS",
    message: "Wykryto prawdopodobny błąd pisowni",
  },
  // The same typo in capitals, for the dictionary (task 30).
  NAPEWNO: {
    replacements: ["NA PEWNO"],
    category: "TYPOS",
    message: "Wykryto prawdopodobny błąd pisowni",
  },
  Wogóle: {
    replacements: ["W ogóle"],
    category: "TYPOS",
    message: "Wykryto prawdopodobny błąd pisowni",
  },
  tą: {
    replacements: ["tę"],
    category: "GRAMMAR",
    message: "W bierniku zaimek „ta” ma formę „tę”.",
  },
  dobry: {
    replacements: [],
    category: "MISC",
    message: "Powtórzony wyraz w zdaniu",
  },
};

// Form → lemma rows, as the dictionary service answers them (task 25).
const FORMS = [
  { form: "kota", lemma: "kot" },
  { form: "kota", lemma: "kota" },
  { form: "Kota", lemma: "Kot" },
  { form: "psa", lemma: "pies" },
];

function matches(annotation) {
  const found = [];
  let offset = 0;
  for (const part of annotation) {
    if ("text" in part) {
      for (const [word, issue] of Object.entries(ISSUES)) {
        for (const match of part.text.matchAll(
          new RegExp(`(?<!\\p{L})${word}(?!\\p{L})`, "gu"),
        ))
          found.push({
            message: issue.message,
            offset: offset + match.index,
            length: word.length,
            replacements: issue.replacements.map((value) => ({ value })),
            rule: { id: `FAKE_${word}`, category: { id: issue.category } },
          });
      }
      offset += part.text.length;
    } else {
      offset += part.markup.length;
    }
  }
  return found.sort((a, b) => a.offset - b.offset);
}

createServer(async (request, response) => {
  if (request.url === "/") return response.end("ok");
  if (request.headers["x-tools-secret"] !== secret) {
    response.statusCode = 401;
    return response.end();
  }
  let body = "";
  for await (const chunk of request) body += chunk;
  if (request.url === "/dict/lemmas") {
    const { forms } = JSON.parse(body);
    if (forms.some((form) => form.includes("AWARIA"))) {
      response.statusCode = 503;
      return response.end();
    }
    if (forms.some((form) => form.includes("POWOLI")))
      await new Promise((resolve) => setTimeout(resolve, 4000));
    response.setHeader("Content-Type", "application/json");
    return response.end(
      JSON.stringify({
        source: "polimorf",
        rows: FORMS.filter(({ form }) => forms.includes(form)),
      }),
    );
  }
  const { annotation } = JSON.parse(new URLSearchParams(body).get("data"));
  const text = annotation.map((part) => part.text ?? "").join("");
  if (text.includes("AWARIA")) {
    response.statusCode = 503;
    return response.end();
  }
  if (text.includes("POWOLI"))
    await new Promise((resolve) => setTimeout(resolve, 4000));
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify({ matches: matches(annotation) }));
}).listen(Number(port), "127.0.0.1");
