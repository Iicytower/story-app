# 40 – Wyświetlanie okładek

Subtask zbiorczego taska [66](../66-covers-and-adult-rating.md) (branch, kolejność, środowisko lokalne).

Wydzielone z dawnego taska 26 (zgłoszenie z 2026-10-30). Na razie tylko okładki folderów (decyzja użytkownika 2026-11-09, task 26).

## Zakres

- Wyświetlanie okładek folderów w widokach ustalonych przy starcie taska.

**Do decyzji użytkownika** (zapytać przed implementacją; wynik jako nowa decyzja w `decisions.md`): widoki z okładką: lista folderów, strona folderu, panel Chapters, edytor, strony publiczne.

## Kryteria akceptacji

1. Folder z okładką pokazuje ją w wybranych widokach, a folder bez okładki nie pokazuje uszkodzonego obrazka.
2. Wymiana okładki od razu pokazuje nową (nowy adres, bez starego obrazka z cache).
3. Strony publiczne pokazują okładkę tylko, jeśli decyzja przy starcie tak stanowi, a okładka 18+ jest tam ukryta za znaczkiem 18+ (task 26).

## Testy

E2E: okładka w wybranych widokach, wymiana, brak okładki, okładka 18+ na stronie publicznej. `manual`: wyświetlanie na stagingu.
