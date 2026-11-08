# 56 – Aktualizacja zależności (2026-11-08)

Raport tygodniowego agenta sprawdzającego zależności (`npm outdated`, `npm audit`, `npm audit --omit=dev`). Task tylko planuje – nie zmienia `package.json` w tym PR-ze.

Stan audytu: wszystkie 23 (1 low, 15 moderate, 6 high, 1 critical); produkcyjne (`--omit=dev`) 14 (1 low, 6 moderate, 6 high, 1 critical).

## Zakres

| Paczka | Obecna → nowa | Typ | Ważność | Uzasadnienie |
| --- | --- | --- | --- | --- |
| next | 16.3.8 → 16.4.5 | minor | **bardzo ważny** (critical, prod, bezpośrednia) | [GHSA-2464-fhr4-w9xw](https://github.com/advisories/GHSA-2464-fhr4-w9xw) (critical, RCE w Image Optimization API z SVG), [GHSA-673q-mjm6-r5xr](https://github.com/advisories/GHSA-673q-mjm6-r5xr) (critical, RCE w `use cache` z typed arrays), [GHSA-p3m5-59mp-jv5r](https://github.com/advisories/GHSA-p3m5-59mp-jv5r) (high, DoS Server Actions). Zakres podatny: `<=16.4.0`. Wymaga ręcznego bumpa (wersja przypięta). Podbić razem z `eslint-config-next` 16.4.5. |
| shadcn (+ `@shadcn/registry`, `ts-morph`, `@ts-morph/common`, `deepmerge`, `zod`) | 4.21.3 → 4.23.0 | minor | **bardzo ważny** (high, prod wg audytu – narzędzie CLI w `dependencies`) | [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) zod (high, wyczerpanie pamięci), [GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4) deepmerge (low), [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) minimatch (moderate). |
| body-parser | → ≥2.4.0 (transitive) | minor | **bardzo ważny** (high, prod) | [GHSA-27r3-jxmh-p828](https://github.com/advisories/GHSA-27r3-jxmh-p828) – DoS przez dodatkowe bajty po skompresowanym body. `npm audit fix`. |
| undici | → ≥7.30.1 (transitive) | minor | **bardzo ważny** (high, prod) | 8 advisories, m.in. [GHSA-4w7w-5xrc-9h26](https://github.com/advisories/GHSA-4w7w-5xrc-9h26) (cache poisoning), [GHSA-2m5v-pch6-74hx](https://github.com/advisories/GHSA-2m5v-pch6-74hx) (obejście walidacji TLS), [GHSA-xjj6-f33q-929c](https://github.com/advisories/GHSA-xjj6-f33q-929c), [GHSA-qrxm-fqhp-jwvm](https://github.com/advisories/GHSA-qrxm-fqhp-jwvm) (DoS). `npm audit fix`. |
| systeminformation | → ≥5.33.16 (transitive) | patch | **bardzo ważny** (high, prod) | [GHSA-3f7j-7jwc-fxfj](https://github.com/advisories/GHSA-3f7j-7jwc-fxfj) – command injection (Windows). `npm audit fix`. |
| fast-uri | → ≥3.1.9 (transitive) | patch | **bardzo ważny** (moderate, prod) | [GHSA-w74x-v6f9-j3xg](https://github.com/advisories/GHSA-w74x-v6f9-j3xg), [GHSA-wjr9-j795-jxcr](https://github.com/advisories/GHSA-wjr9-j795-jxcr) (moderate), [GHSA-xhq7-xmqj-769h](https://github.com/advisories/GHSA-xhq7-xmqj-769h), [GHSA-333x-w4r6-6crp](https://github.com/advisories/GHSA-333x-w4r6-6crp) (low). `npm audit fix`. |
| ip-address | → >10.7.3 (transitive) | patch | **bardzo ważny** (moderate, prod) | [GHSA-rxp7-6hxx-x8q5](https://github.com/advisories/GHSA-rxp7-6hxx-x8q5) – ReDoS w `Address6`. `npm audit fix`. |
| qs | → >6.16.0 (transitive) | patch | **bardzo ważny** (moderate, prod) | [GHSA-6pq8-jhm2-2vcw](https://github.com/advisories/GHSA-6pq8-jhm2-2vcw) – DoS w `qs.stringify`. `npm audit fix`. |
| postcss-selector-parser (przez `@tailwindcss/typography`) | → wersja poprawiona | patch | **bardzo ważny** (moderate, tylko dev) | [GHSA-rj75-hqrm-r3gf](https://github.com/advisories/GHSA-rj75-hqrm-r3gf). Uwaga: `npm audit` proponuje `@tailwindcss/typography@0.5.4` (downgrade) – nie stosować; sprawdzić `npm audit fix` / `overrides`. |
| minimatch / `typescript-eslint` (przez `eslint-config-next`) | → poprawiona | patch | **bardzo ważny** (moderate, tylko dev) | [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249). `npm audit` proponuje `eslint-config-next@15.5.29` (downgrade) – nie stosować; bump do 16.4.5 + `npm audit fix`. |
| typescript | 5.9.3 → 7.0.2 | **major** | niezbyt ważny | [Release notes](https://github.com/microsoft/TypeScript/releases). Duże ryzyko (zmiany w kompilatorze, kompatybilność z ESLint/Next/Vitest). Sprawdzić `tsc`, hooki i `eslint-config-next`. |
| eslint | 9.39.5 → 10.14.0 | **major** | niezbyt ważny | [Migration guide](https://eslint.org/docs/latest/use/migrate-to-10.0.0). Zależy od wsparcia `eslint-config-next`/pluginów. |
| @types/node | 22.20.5 → 26.6.6 | **major** | niezbyt ważny | Typy powinny odpowiadać wersji Node w runtime (Vercel/lokalnie) – zostać przy zgodnej linii (22), chyba że Node zostanie podniesiony. |
| marked | 17.0.6 → 18.1.3 | **major** | niezbyt ważny | [Releases](https://github.com/markedjs/marked/releases). Sprawdzić parsowanie markdown (eksport, import). |
| react, react-dom | 19.2.8 → 19.3.1 | minor | niezbyt ważny | [Changelog](https://github.com/facebook/react/blob/main/CHANGELOG.md). Podbijać razem. |
| cn | 0.4.0 → 0.5.2 | minor (0.x) | niezbyt ważny | W 0.x minor może łamać API – sprawdzić użycie. |
| @playwright/test | 1.63.0 → 1.65.0 | minor | niezbyt ważny | [Release notes](https://github.com/microsoft/playwright/releases). Może wymagać nowej przeglądarki. |
| lucide-react | 1.52.0 → 1.70.0 | minor | niezbyt ważny | Nowe ikony; sprawdzić usunięte/przemianowane. |
| radix-ui | 1.7.0 → 1.8.1 | minor | niezbyt ważny | Sprawdzić komponenty shadcn. |
| react-resizable-panels | 4.14.7 → 4.20.0 | minor | niezbyt ważny | Sprawdzić layout edytora. |
| @tiptap/markdown, pm, react, starter-kit | 3.32.0 → 3.33.0 | minor | niezbyt ważny | Podbijać razem (spójność wersji Tiptap). |
| vitest | 5.0.3 → 5.1.0 | minor | niezbyt ważny | Sprawdzić `npm test`. |
| eslint-config-next | 16.3.8 → 16.4.5 | minor | niezbyt ważny (patrz wiersz `next`) | Trzymać w wersji zgodnej z `next`. |
| mongoose | 9.11.0 → 9.12.0 | minor | niezbyt ważny | Sprawdzić testy integracyjne. |
| @tailwindcss/postcss, tailwindcss | 4.3.3 → 4.3.5 | patch | niezbyt ważny | Podbijać razem. |
| docx | 9.15.0 → 9.15.3 | patch | niezbyt ważny | Eksport DOCX. |
| prettier | 3.9.9 → 3.9.10 | patch | niezbyt ważny | Może zmienić formatowanie. |
| turndown | 7.2.4 → 7.2.5 | patch | niezbyt ważny | Import HTML → markdown. |

Pominięte: `next-auth` (latest 4.24.15 to starsza linia; projekt używa v5 beta) i `unpdf` (latest 1.9.1 < obecne 2.1.0) – fałszywe alarmy `npm outdated`.

Żaden otwarty task w `docs/tasks/` nie obejmuje tych paczek.

### Uwagi do majorów

- TypeScript 7, ESLint 10: ryzyko niekompatybilności z `eslint-config-next`, hookiem Stop (`tsc --noEmit`) i Vitest; najlepiej osobne bumpy, jeśli `npm run verify` zawiedzie.
- marked 18: sprawdzić testy importu/eksportu.
- @types/node 26: tylko jeśli runtime Node jest zgodny.

### Sposób naprawy

- Wystarczy `npm audit fix`: body-parser, undici, systeminformation, fast-uri, ip-address, qs, zod, deepmerge, minimatch, ts-morph (zależności tranzytywne).
- Ręczny bump: `next` + `eslint-config-next` (16.4.5), `shadcn` (4.23.0).
- Nie wykonywać `npm audit fix --force` (proponuje downgrade `eslint-config-next` i `@tailwindcss/typography`).

## Kryteria akceptacji

1. `npm audit --omit=dev` nie zgłasza podatności high/critical.
2. `next` i `eslint-config-next` w wersji ≥ 16.4.5 (lub udokumentowany powód).
3. Pozostałe paczki z tabeli podbite do wskazanych wersji albo powód pominięcia opisany (zwłaszcza majory).
4. Aplikacja działa jak dotychczas.

## Testy

- `npm run verify` (regresja).
- `manual`: `npm audit --omit=dev` przed i po zmianach.
- `manual`: deploy na staging i sprawdzenie działania aplikacji.
