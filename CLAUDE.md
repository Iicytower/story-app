# Story App

@AGENTS.md

Aplikacja webowa do pisania opowiadań (docelowo publiczna, D46) w markdown (Next.js App Router, TypeScript, MongoDB Atlas + Mongoose, Auth.js Credentials/JWT, Tailwind + shadcn/ui, Vercel).

## Dokumentacja

- `docs/spec.md` – specyfikacja funkcjonalna (kopia dokumentu z Claude Docs, nie edytować bez prośby).
- `docs/decisions.md` – decyzje i odstępstwa od spec; **ma pierwszeństwo nad spec**. Nową decyzję dopisz tutaj i jednym wierszem w spisie `docs/decisions/index.md`. Duże decyzje mają własne pliki w `docs/decisions/` (D80: `docs/decisions/d80/<obszar>.md`, w `decisions.md` tylko indeks) – czytaj tylko pliki potrzebne do taska.
- `docs/testing.md` – strategia testów (unit / integracyjne z MongoDB w Dockerze / E2E Playwright). **Obowiązkowa przy każdym tasku.**
- `docs/tasks/README.md` – lista tasków ze statusami, branche i definicja „zrobione”; szczegóły otwartych tasków w `docs/tasks/NN-*.md` (sekcje Zakres, Kryteria akceptacji, Testy), zakończonych w `docs/tasks/done/`. Otwarte taski są w tabeli w kolejności realizacji.
- `README.md` (po angielsku) – krótki, marketingowy opis aplikacji, stack, proces pracy z Claude Code i uruchamianie lokalne (ręcznie i skillem `/local-setup`). Aktualizuj go w ramach taska, który zmienia coś z tych sekcji (np. stack, komendy, wymagania, kroki uruchomienia, skille, hooki); przy zmianie kroków uruchomienia popraw też `.claude/skills/local-setup/SKILL.md`. Opis domenowy zostaje ogólny (kilka zdań), bez listy funkcji.
- `docs/deploy.md` – środowiska (produkcja, staging), wydania, ustalenia z Vercela i Atlasa; części w `docs/deploy/` (`migrations.md`, `tools.md` – lokalny stos i Mikrus, `backup.md`).

## Praca z taskami

1. Przed startem przeczytaj plik taska oraz wskazane sekcje spec i `decisions.md`.
2. Utwórz branch `feature/NN-<slug>` z `develop` i ustaw status `[~]` w `docs/tasks/README.md`. Wyjątek: taski systemu społecznościowego (68–91, D80) – branch z `feature/social` i merge do niego; `feature/social` do `develop` merguje użytkownik.
3. Niejasności lub kilka sensownych rozwiązań → zapytaj, zanim zaimplementujesz.
4. Napisz testy z sekcji „Testy” taska razem z kodem (nie na końcu). Każde kryterium akceptacji musi mieć test albo oznaczenie `manual`.
5. `npm run verify` musi przechodzić. Nie zamykaj taska z czerwonymi lub pominiętymi testami.
6. W odpowiedzi do użytkownika podaj mapowanie: kryterium akceptacji → test (lub wynik weryfikacji `manual`).
7. Status `[x]`, plik taska przenieś do `docs/tasks/done/` (`git mv`) i popraw link w tabeli, potem jeden commit na task na branchu taska (wiadomość: `NN: <krótki opis>`). Merge do `develop` po zakończeniu taska; push `develop` tylko na prośbę użytkownika. Wiadomości commitów oraz tytuły i opisy PR-ów pisz po angielsku. **Nigdy nie merguj do `staging` ani `main` i nie pushuj na `staging`, `main` ani `master`** – robi to wyłącznie użytkownik, także przy prośbie o testy na stagingu (D45).

## Komendy

- `npm run dev` / `build` / `lint` / `typecheck` / `format`
- `npm test` (Vitest: unit + integracyjne), `npm run test:e2e` (Playwright), `npm run verify` (wszystko)
- Testy nigdy nie używają bazy z `.env.local` – tylko baz `story_app_test_*` / `story_app_e2e` w kontenerze Docker (`docker-compose.yml`, start automatyczny w `globalSetup`).
- `npm run db:up` – lokalny MongoDB w Dockerze (dev: `MONGODB_URI=mongodb://127.0.0.1:27017/story_app`).
- `npm run up` / `down` – całość lokalnie: MongoDB, Coolify i serwer narzędzi w Dockerze (task 54, `docs/deploy/tools.md`); `up` dopisuje `TOOLS_API_URL` i `TOOLS_API_SECRET` do `.env.local`. Sekrety w `.tools/` – nigdy ich nie wypisuj.
- `npm run tools:remote` / `dict:upload:remote` – serwer narzędzi na Mikrusie przez SSH (task 28, konfiguracja w `.tools/mikrus/remote.env`, instrukcja w `docs/deploy/tools.md`).
- `npm run migrate` – migracje bazy z `.env.local` (`migrations/`, D14). Na Vercelu uruchamiane automatycznie w buildzie produkcji i stagingu.
- `npm run create-account` – interaktywny skrypt dodający konto (uruchamia użytkownik, nie Claude).
- `npm run tags -- list|set <klucz> <en> <pl>|remove <klucz>` – lista predefiniowanych tagów w bazie z `.env.local` (D79; zmiany uruchamia użytkownik).
- `npm run admin -- list|add <nick>|remove <nick>` – lista adminów (`User.role`, D80) w bazie z `.env.local` (zmiany uruchamia użytkownik).
- Package manager: npm. Instalacja pakietów tylko po zgodzie użytkownika.

## Zasady projektu

- UI wielojęzyczne (D46): angielski i polski, wybór w sidebarze; dark mode. Projektowane pod desktop; strona główna (D54) i edytor (D12) działają też na wąskim ekranie.
- Wielu użytkowników (D1): każde zapytanie o `stories` filtruje po `userId` z sesji; cudze = `NOT_FOUND`/404. `userId` nigdy z wejścia klienta.
- Odczyt: Server Components bezpośrednio z bazy. Zapis: Server Actions. Route Handlers tylko dla eksportu i Auth.js.
- Każda Server Action sprawdza sesję i zwraca `{ ok: true, ... } | { ok: false, error, message }` – nie rzuca wyjątków.
- Zapytania o opowiadania zawsze z `deletedAt: null` (poza stroną publiczną, która też go wymaga).
- Mongoose: `.lean()` + serializacja (`_id` → `id: string`, daty → ISO string) przed przekazaniem do klienta; model rejestrowany przez `mongoose.models.X ?? mongoose.model(...)`.
- Strony w `app/[locale]/` (D46). `Link`, `redirect`, `useRouter`, `usePathname`, `getPathname` tylko z `@/i18n/navigation`, nigdy z `next/link` / `next/navigation`. Route Handlery (eksport, `api/`) poza `[locale]`.
- Każdy tekst interfejsu w `messages/en.json` i `messages/pl.json` (D46; brak klucza w `pl` to błąd `tsc`): `useTranslations` / `getTranslations`, także `aria-label`, `placeholder`, `title`, `metadata`. Liczby mnogie przez ICU (`{count, plural, ...}`). Komunikaty Server Actions przez `actionError(code, key)` z `lib/i18n/action-error.ts`; walidacja w `lib/` zwraca klucz (`ValidationError`), akcja tłumaczy go `translateError`.
- Podgląd markdown: `react-markdown` + `remark-breaks`, nigdy `rehype-raw`.
- API bibliotek (Next.js, Auth.js, Mongoose, shadcn) sprawdzaj w aktualnej dokumentacji, nie z pamięci – wersje szybko się zmieniają (jak szukać: „Oszczędzanie kontekstu”).

## Automatyzacja Claude (`.claude/`)

- Hooki: PostToolUse – ESLint `--fix` + Prettier na edytowanym pliku; Stop i SubagentStop (`implementer`, `verifier`, `merger`) – `tsc --noEmit` przy zmienionych plikach TS, błędy trzeba naprawić; PreToolUse – `protect-branches.sh` (D45). Hooki trybu `/autorun` opisuje skill `autorun`.
- Agenci (`.claude/agents/`): `researcher`, `implementer`, `verifier`, `reviewer`, `ui-checker`, `security-auditor`, `docs-keeper`, `merger`; skille `test-patterns` (w `implementer` i `verifier`) i `social-checklist` (taski 68–91). Agenci zapisujący pliki pracują pojedynczo (jedno drzewo robocze). Modele: Opus dla `implementer`, `reviewer`, `security-auditor`; Sonnet dla pozostałych. Drobne zmiany (kilka plików, bez nowej logiki uprawnień) główna sesja robi sama, bez agenta.
- Skill `/autorun <task zbiorczy>`: przebieg tasków bez udziału użytkownika.

## Oszczędzanie kontekstu

- Decyzje: najpierw spis `docs/decisions/index.md`, potem tylko potrzebna decyzja (`grep -n "^## Dnn" docs/decisions.md` i Read z `offset`/`limit`, D80 w `docs/decisions/d80/`). Nie czytaj całego `docs/decisions.md`.
- Pliki ponad ok. 300 linii (`messages/*.json`, duże komponenty, dokumenty) czytaj przez `grep -n` i zakres linii, nie w całości.
- Dokumentacja Next.js (AGENTS.md): tylko przy API nowym albo niepewnym; szukaj `grep -rln "<api>" node_modules/next/dist/docs/` i czytaj znaleziony fragment, albo context7. Nie czytaj całych przewodników „na zapas”. Pozostałe biblioteki – context7.
- Testy: reporter `dot` (Vitest wypisuje konsolę tylko z nieudanych testów). Per zmiana uruchamiaj `npx vitest related <pliki> --run` i specy dotkniętych stron; pełne `npm run verify` rzadziej (przed merge'em, co kilka tasków).
- Wynik długich komend przycinaj (`| tail -n 40`), logi serwerów zapisuj do pliku i czytaj fragmentami.
