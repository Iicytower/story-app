# 18 – Import opowiadań

Zgłoszenie użytkownika (2026-10-30), wydzielone z taska 17. Formaty eksportu: D31.

## Zakres

- Formaty: wszystkie z eksportu (`.md`, `.txt`, `.html`, `.docx`, `.odt`, `.pdf`, `.epub`, `.fb2`) oraz `.zip` z eksportu (rozdziały w kolejności numerów i `notes.md`).
- Miejsce: `/stories` (`.zip` i wielorozdziałowe tworzą nowy folder, przy `.md` wybór folderu) oraz widok folderu (dodaje rozdziały do tego folderu).
- Zajęty tytuł lub nazwa folderu: sufiks „ (2)”, jak D25.
- Parsowanie w przeglądarce, plik do 50 MB. Server Action dostaje tylko tekst, limit 4 MB (`serverActions.bodySizeLimit`) i waliduje wszystko sama: rozmiar, liczbę rozdziałów, tytuły, `userId` z sesji, właściciela folderu.
- Import `.pdf` z ostrzeżeniem w UI, że formatowanie nie zostaje zachowane.
- Pakiety zatwierdzone przez użytkownika: `mammoth`, `unpdf`, `turndown`, `htmlparser2`, `yaml` przeniesiony do `dependencies`. Parsery ładowane przez `import()` po kliknięciu.
- Wpis w `decisions.md`.

## Kryteria akceptacji

1. Na `/stories` i w widoku folderu jest przycisk „Import…”, dialog przyjmuje wszystkie formaty z zakresu.
2. Plik z jednym rozdziałem na `/stories`: wybór folderu i edycja tytułu; po imporcie otwiera się rozdział.
3. `.zip` i plik z wieloma rozdziałami na `/stories` tworzą nowy folder z kolejnością z pliku.
4. Rozdziały wykryte z nagłówków mają przełącznik „Split into N chapters”, domyślnie włączony.
5. W widoku folderu rozdziały trafiają do tego folderu, notatki z pliku są dopisywane na końcu notatek folderu.
6. Zajęty tytuł lub nazwa folderu dostają sufiks „ (2)”.
7. Sekcje „Notes” i „Folder notes” z eksportu wracają do notatek; `.md` z frontmatterem odzyskuje tytuł i notatki. Rozdziały dostają datę importu.
8. Import `.pdf` pokazuje ostrzeżenie o utracie formatowania.
9. Plik ponad 50 MB, nieobsługiwany format lub zbyt duży tekst dają czytelny błąd.
10. Akcja sama waliduje wejście: sesja, właściciel folderu (D1), liczba rozdziałów, tytuły, rozmiar w bajtach. Odrzucony import niczego nie zapisuje.

## Testy

Test eksport → import dla każdego formatu. Integracyjne akcji: izolacja użytkowników (D1), sufiksy, zbyt duży tekst, brak sesji. E2E: przepływ importu.
