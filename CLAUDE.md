# Story App

Prywatna aplikacja webowa do pisania opowiadań w markdown (Next.js App Router, TypeScript, MongoDB Atlas + Mongoose, Auth.js Credentials/JWT, Tailwind + shadcn/ui, Vercel).

## Dokumentacja

- `docs/spec.md` – specyfikacja funkcjonalna (kopia dokumentu z Claude Docs, nie edytować bez prośby).
- `docs/decisions.md` – decyzje i odstępstwa od spec; **ma pierwszeństwo nad spec**. Nową decyzję dopisz tutaj.
- `docs/tasks/README.md` – lista tasków ze statusami; szczegóły w `docs/tasks/NN-*.md`.

## Praca z taskami

1. Przed startem przeczytaj plik taska oraz wskazane sekcje spec i `decisions.md`.
2. Ustaw status `[~]` w `docs/tasks/README.md`.
3. Niejasności lub kilka sensownych rozwiązań → zapytaj, zanim zaimplementujesz.
4. Po implementacji: `npm run lint`, `npm run typecheck`, `npm test` muszą przechodzić; sprawdź kryteria akceptacji.
5. Status `[x]`, potem jeden commit na task na `main` (wiadomość: `NN: <krótki opis>`). Bez push.

## Komendy

- `npm run dev` / `build` / `lint` / `typecheck` / `test` / `format`
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
