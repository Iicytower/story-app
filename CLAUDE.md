# Story App

Prywatna aplikacja webowa do pisania opowiadań w markdown (Next.js App Router, TypeScript, MongoDB Atlas + Mongoose, Auth.js Credentials/JWT, Tailwind + shadcn/ui, Vercel).

## Dokumentacja

- `docs/spec.md` – specyfikacja funkcjonalna (kopia dokumentu z Claude Docs, nie edytować bez prośby).
- `docs/decisions.md` – decyzje i odstępstwa od spec; **ma pierwszeństwo nad spec**. Nową decyzję dopisz tutaj.
- `docs/testing.md` – strategia testów (unit / integracyjne z `mongodb-memory-server` / E2E Playwright). **Obowiązkowa przy każdym tasku.**
- `docs/tasks/README.md` – lista tasków ze statusami i definicja „zrobione”; szczegóły w `docs/tasks/NN-*.md` (sekcje Zakres, Kryteria akceptacji, Testy).

## Praca z taskami

1. Przed startem przeczytaj plik taska oraz wskazane sekcje spec i `decisions.md`.
2. Ustaw status `[~]` w `docs/tasks/README.md`.
3. Niejasności lub kilka sensownych rozwiązań → zapytaj, zanim zaimplementujesz.
4. Napisz testy z sekcji „Testy” taska razem z kodem (nie na końcu). Każde kryterium akceptacji musi mieć test albo oznaczenie `manual`.
5. `npm run verify` musi przechodzić (przed taskiem 05: `lint`, `typecheck`, `test`). Nie zamykaj taska z czerwonymi lub pominiętymi testami.
6. W odpowiedzi do użytkownika podaj mapowanie: kryterium akceptacji → test (lub wynik weryfikacji `manual`).
7. Status `[x]`, potem jeden commit na task na `main` (wiadomość: `NN: <krótki opis>`). Bez push.

## Komendy

- `npm run dev` / `build` / `lint` / `typecheck` / `format`
- `npm test` (Vitest: unit + integracyjne), `npm run test:e2e` (Playwright), `npm run verify` (wszystko)
- Testy nigdy nie używają bazy z `.env.local` – tylko `mongodb-memory-server`.
- `npm run create-account` – interaktywny skrypt dodający konto (uruchamia użytkownik, nie Claude).
- Package manager: npm. Instalacja pakietów tylko po zgodzie użytkownika.

## Zasady projektu

- UI w całości po angielsku, tylko desktop, dark mode.
- Wielu użytkowników (D1): każde zapytanie o `stories` filtruje po `userId` z sesji; cudze = `NOT_FOUND`/404. `userId` nigdy z wejścia klienta.
- Odczyt: Server Components bezpośrednio z bazy. Zapis: Server Actions. Route Handlers tylko dla eksportu i Auth.js.
- Każda Server Action sprawdza sesję i zwraca `{ ok: true, ... } | { ok: false, error, message }` – nie rzuca wyjątków.
- Zapytania o opowiadania zawsze z `deletedAt: null` (poza stroną publiczną, która też go wymaga).
- Mongoose: `.lean()` + serializacja (`_id` → `id: string`, daty → ISO string) przed przekazaniem do klienta; model rejestrowany przez `mongoose.models.X ?? mongoose.model(...)`.
- Podgląd markdown: `react-markdown` + `remark-breaks`, nigdy `rehype-raw`.
- API bibliotek (Next.js, Auth.js, Mongoose, shadcn) sprawdzaj w aktualnej dokumentacji (context7), nie z pamięci – wersje szybko się zmieniają.

## Automatyzacja Claude (`.claude/`)

- Hook PostToolUse: ESLint `--fix` + Prettier na edytowanym pliku.
- Hook Stop: `tsc --noEmit`, gdy są zmienione pliki TS; błędy trzeba naprawić.
