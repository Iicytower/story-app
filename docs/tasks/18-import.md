# 18 – Import opowiadań

Zgłoszenie użytkownika (2026-10-30), wydzielone z taska 17. Formaty eksportu: D31.

## Zakres

- Formaty: wszystkie z eksportu (`.md`, `.txt`, `.html`, `.docx`, `.odt`, `.pdf`, `.epub`, `.fb2`) oraz `.zip` z eksportu (D32: rozdziały w kolejności numerów i `notes.<format>`).
- Miejsce: `/stories` (`.zip` i wielorozdziałowe tworzą nowy folder, przy `.md` wybór folderu) oraz widok folderu (dodaje rozdziały do tego folderu).
- Zajęty tytuł lub nazwa folderu: sufiks „ (2)”, jak D25.
- Parsowanie w przeglądarce, plik do 50 MB. Server Action dostaje tylko tekst, limit 4 MB (`serverActions.bodySizeLimit`) i waliduje wszystko sama: rozmiar, liczbę rozdziałów, tytuły, `userId` z sesji, właściciela folderu.
- Import `.pdf` z ostrzeżeniem w UI, że formatowanie nie zostaje zachowane.
- Pakiety zatwierdzone przez użytkownika: `mammoth`, `unpdf`, `turndown`, `htmlparser2`, `yaml` przeniesiony do `dependencies` (tylko jeśli import ma czytać frontmatter z plików spoza aplikacji; własny eksport już go nie tworzy, D33). Parsery ładowane przez `import()` po kliknięciu.
- Wpis w `decisions.md`.

## Kryteria akceptacji

Do uzupełnienia przy starcie taska.

## Testy

Test eksport → import dla każdego formatu. Integracyjne akcji: izolacja użytkowników (D1), sufiksy, zbyt duży tekst, brak sesji. E2E: przepływ importu.
