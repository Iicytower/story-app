# D47 – Publiczny link bez prefiksu języka (2026-11-03)

Status: aktualna. Zmieniona w D83 (adresy).

- Link publiczny pokazywany i kopiowany w edytorze i folderze (`Public link`) zostaje bez prefiksu (`/p/nick/folder`): odbiorca trafia na swój język przez przekierowanie z proxy (D46), a nie na język autora (decyzja użytkownika).
- Linki klikane w aplikacji (wyszukiwarka, nawigacja rozdziałów) idą przez helpery `next-intl` i mają prefiks bieżącego języka.
- Route Handlery eksportu leżą w `app/stories/[id]/export` i `app/folders/[id]/export`, poza `app/[locale]`, pod tymi samymi adresami co wcześniej.
