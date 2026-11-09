# Aktualizacja zależności (2026-11-09)

Zadanie bez numeru, wygenerowane automatycznie przez cotygodniowy przegląd zależności (`npm outdated`, `npm audit`, `npm audit --omit=dev`). Stan: 23 podatności w `npm audit` (1 critical, 6 high, 15 moderate, 1 low), w tym 14 w zależnościach produkcyjnych (`--omit=dev`; 1 critical, 6 high, 6 moderate, 1 low). Zmiana względem przeglądu z 2026-11-08: `react-resizable-panels` ma teraz wersję docelową 4.21.0.

## Zakres

Najpierw poprawki bezpieczeństwa, potem majory, minory i patche.

| Paczka | Obecna → nowa | Typ | Ważność | Uzasadnienie |
| --- | --- | --- | --- | --- |
| next | 16.3.8 → 16.4.5 | minor | **bardzo ważny** (prod) | Trzy advisory dla `>=16.0.0 <=16.4.0`: [GHSA-2464-fhr4-w9xw](https://github.com/advisories/GHSA-2464-fhr4-w9xw) (critical, nieuwierzytelnione RCE w Image Optimization API przy SVG), [GHSA-673q-mjm6-r5xr](https://github.com/advisories/GHSA-673q-mjm6-r5xr) (critical, RCE w funkcjach `use cache` zwracających typed arrays), [GHSA-p3m5-59mp-jv5r](https://github.com/advisories/GHSA-p3m5-59mp-jv5r) (high, DoS w Server Actions). `npm audit` nie oznacza tego jako major. |
| undici (przechodnia) | 7.x (<7.30.1) → ≥7.30.1 | patch/minor | **bardzo ważny** (prod) | 8 advisory, m.in. high: [GHSA-xjj6-f33q-929c](https://github.com/advisories/GHSA-xjj6-f33q-929c), [GHSA-4w7w-5xrc-9h26](https://github.com/advisories/GHSA-4w7w-5xrc-9h26), [GHSA-2m5v-pch6-74hx](https://github.com/advisories/GHSA-2m5v-pch6-74hx) (obejście walidacji TLS), [GHSA-qrxm-fqhp-jwvm](https://github.com/advisories/GHSA-qrxm-fqhp-jwvm); moderate: GHSA-4qv8-2p9j-2685, GHSA-f72v-6w45-q472, GHSA-9fm3-97px-rjf6, GHSA-55wc-3pg8-jfw6. |
| zod (przechodnia, przez shadcn) | <4.6.6 → ≥4.6.6 | patch | **bardzo ważny** (prod) | [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) (high, wyczerpanie pamięci przy walidacji dużych kolekcji). Ciągnie `shadcn` i `@shadcn/registry`. |
| shadcn (łańcuch: @shadcn/registry, deepmerge, ts-morph, @ts-morph/common, minimatch) | 4.21.3 → 4.23.0 | minor | **bardzo ważny** (prod wg audytu) | `shadcn` jest oznaczony high przez zod; do tego [GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4) (deepmerge, low) i [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) (minimatch, moderate, DoS). Prawdopodobnie narzędzie CLI, ale jest w dependencies. |
| body-parser (przechodnia) | 2.0.0–2.3.0 → ≥2.4.0 | minor | **bardzo ważny** (prod) | [GHSA-27r3-jxmh-p828](https://github.com/advisories/GHSA-27r3-jxmh-p828) (high, DoS przez dodatkowe bajty po skompresowanym body). |
| systeminformation (przechodnia) | <5.33.16 → ≥5.33.16 | patch | **bardzo ważny** (prod) | [GHSA-3f7j-7jwc-fxfj](https://github.com/advisories/GHSA-3f7j-7jwc-fxfj) (high, command injection w `services()` na Windows). |
| fast-uri (przechodnia) | 3.0.0–3.1.8 → ≥3.1.9 | patch | **bardzo ważny** (prod) | [GHSA-w74x-v6f9-j3xg](https://github.com/advisories/GHSA-w74x-v6f9-j3xg) (moderate), [GHSA-wjr9-j795-jxcr](https://github.com/advisories/GHSA-wjr9-j795-jxcr) (moderate), [GHSA-xhq7-xmqj-769h](https://github.com/advisories/GHSA-xhq7-xmqj-769h) i [GHSA-333x-w4r6-6crp](https://github.com/advisories/GHSA-333x-w4r6-6crp) (low). |
| ip-address (przechodnia) | ≤10.7.3 → nowsza | patch | **bardzo ważny** (prod) | [GHSA-rxp7-6hxx-x8q5](https://github.com/advisories/GHSA-rxp7-6hxx-x8q5) (moderate, kwadratowy czas przy długim zone identifier). |
| qs (przechodnia) | 6.7.0–6.16.0 → nowsza | patch | **bardzo ważny** (prod) | [GHSA-6pq8-jhm2-2vcw](https://github.com/advisories/GHSA-6pq8-jhm2-2vcw) (moderate, DoS w `qs.stringify` z `arrayFormat: 'comma'`). |
| postcss-selector-parser (przechodnia, przez @tailwindcss/typography) | <6.1.5 → ≥6.1.5 | patch | **bardzo ważny** (tylko dev) | [GHSA-rj75-hqrm-r3gf](https://github.com/advisories/GHSA-rj75-hqrm-r3gf) (moderate, kwadratowa złożoność parsowania selektorów). Dotyczy `@tailwindcss/typography`. |
| minimatch w @typescript-eslint/typescript-estree (przechodnia) i łańcuch typescript-eslint / eslint-config-next | – | patch | **bardzo ważny** (tylko dev) | [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) (moderate). `npm audit` oznacza `@typescript-eslint/*`, `typescript-eslint` i `eslint-config-next` (moderate) wyłącznie przez ten minimatch. |
| eslint | 9.39.5 → 10.14.0 | **major** | niezbyt ważny | Nowa wersja główna; 9.39.5 jest oznaczona jako deprecated (`npm warn deprecated` przy instalacji). Sprawdzić zgodność z `eslint-config-next` i pluginami. [Migration guide](https://eslint.org/docs/latest/use/migrate-to-10.0.0). |
| typescript | 5.9.3 → 7.0.2 | **major** | niezbyt ważny | Duże ryzyko (nowy kompilator, możliwe zmiany w API i typach, zgodność z Next, typescript-eslint, Vitest). Zalecane osobne zadanie lub odłożenie. [Release notes](https://github.com/microsoft/TypeScript/releases). |
| marked | 17.0.6 → 18.1.3 | **major** | niezbyt ważny | Używany w imporcie/parsowaniu markdown; sprawdzić zmiany w API i wyniku renderowania. [Releases](https://github.com/markedjs/marked/releases). |
| @types/node | 22.20.5 → 26.6.6 | **major** | niezbyt ważny | Typy powinny odpowiadać wersji Node w projekcie (D34: Node 24), więc raczej 24.x, nie 26. |
| cn | 0.4.0 → 0.5.2 | minor (0.x, może łamać) | niezbyt ważny | Wersje 0.x mogą zawierać zmiany łamiące w minorze; sprawdzić changelog. |
| react, react-dom | 19.2.8 → 19.3.1 | minor | niezbyt ważny | Sprawdzić [changelog Reacta](https://github.com/facebook/react/blob/main/CHANGELOG.md), zgodność z Next i Tiptap. |
| eslint-config-next | 16.3.8 → 16.4.5 | minor | niezbyt ważny | Podbić razem z `next`. |
| @playwright/test | 1.63.0 → 1.65.0 | minor | niezbyt ważny | Nowe wersje przeglądarek; zaktualizować wersję Chromium w CI i lokalnie. [Releases](https://github.com/microsoft/playwright/releases). |
| @tiptap/markdown, @tiptap/pm, @tiptap/react, @tiptap/starter-kit | 3.32.0 → 3.33.0 | minor | niezbyt ważny | Podbijać razem; sprawdzić [changelog Tiptap](https://github.com/ueberdosis/tiptap/releases) i testy edytora. |
| lucide-react | 1.52.0 → 1.70.0 | minor | niezbyt ważny | Nowe ikony; sprawdzić ewentualne zmiany nazw ikon. |
| mongoose | 9.11.0 → 9.12.0 | minor | niezbyt ważny | [Changelog](https://github.com/Automattic/mongoose/blob/master/CHANGELOG.md). |
| radix-ui | 1.7.0 → 1.8.1 | minor | niezbyt ważny | Sprawdzić komponenty shadcn (dialogi, tooltipy). |
| react-resizable-panels | 4.14.7 → 4.21.0 | minor | niezbyt ważny | Sprawdzić układ paneli w edytorze. |
| vitest | 5.0.3 → 5.1.0 | minor | niezbyt ważny | [Releases](https://github.com/vitest-dev/vitest/releases). |
| @tailwindcss/postcss, tailwindcss | 4.3.3 → 4.3.5 | patch | niezbyt ważny | Podbijać razem. |
| docx | 9.15.0 → 9.15.3 | patch | niezbyt ważny | Eksport `.docx`. |
| prettier | 3.9.9 → 3.9.10 | patch | niezbyt ważny | Może zmienić formatowanie, uruchomić `npm run format`. |
| turndown | 7.2.4 → 7.2.5 | patch | niezbyt ważny | Import HTML/docx. |

Pominięte jako fałszywe alarmy `npm outdated`: `next-auth` (zainstalowane `5.0.0-beta.32`, „latest” 4.24.15 to inny kanał) i `unpdf` (zainstalowane 2.1.0, „latest” 1.9.1 jest niższe, patrz [zadanie 21](done/21-unpdf-2.md)).

### Uwagi

- **Wystarczy `npm audit fix` (bez zmian w package.json):** przechodnie `undici`, `zod`, `body-parser`, `systeminformation`, `fast-uri`, `ip-address`, `qs`, `deepmerge`, `ts-morph`, `@ts-morph/common`, `@shadcn/registry`, częściowo `minimatch` (audyt zgłasza `fixAvailable: true`).
- **Ręczny bump:** `next` do 16.4.5 (razem z `eslint-config-next` 16.4.5) i `shadcn` do 4.23.0 (po wejściu poprawionego `zod`).
- **Uwaga na `npm audit fix --force`:** proponuje **downgrade** `eslint-config-next` do 15.5.29 (major wstecz) i `@tailwindcss/typography` do 0.5.4. Nie używać `--force`. Dla łańcucha `@typescript-eslint/*` lepiej poczekać na nową wersję `typescript-eslint` z poprawionym `minimatch` albo dodać `overrides` dla `minimatch`; to zależności tylko deweloperskie.
- **Majory** (`eslint`, `typescript`, `marked`, `@types/node`): osobno, każdy z własnym przebiegiem `npm run verify`. TypeScript 7 i ESLint 10 mogą wymagać zmian w konfiguracji i w pluginach.
- Przy instalacji pojawia się ostrzeżenie `EBADENGINE`: `unpdf@2.1.0` wymaga Node ≥24, a środowisko agenta ma Node 22. To nie błąd projektu (D34), ale CI i Vercel muszą używać Node 24.

## Kryteria akceptacji

1. `npm audit --omit=dev` nie zgłasza podatności high ani critical (docelowo żadnych).
2. `next` i `eslint-config-next` są zaktualizowane do 16.4.5 (lub nowszej poprawionej wersji); pozostałe paczki z tabeli podniesione do wymienionych wersji albo przy każdej pominiętej jest udokumentowany powód (np. odłożony major).
3. Nie użyto `npm audit fix --force` ani downgrade'ów `eslint-config-next` i `@tailwindcss/typography`.
4. Aplikacja działa jak wcześniej: edytor, import/eksport, logowanie, strona publiczna, build produkcyjny.
5. Wersje majorów (`eslint`, `typescript`, `marked`, `@types/node`) zaktualizowane w osobnych krokach albo świadomie odroczone z adnotacją w pliku taska.

## Testy

- `npm run verify` (regresja: lint, typecheck, unit, integracyjne, E2E).
- `manual`: `npm audit --omit=dev` przed i po aktualizacji, porównanie liczby podatności.
- `manual`: deploy na stagingu (robi użytkownik) i szybki przegląd edytora, importu/eksportu oraz logowania.
