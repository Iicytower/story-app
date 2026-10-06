# 07 – Lista opowiadań i wyszukiwanie

Spec: „Lista opowiadań”.

## Zakres

- `/stories` (Server Component): opowiadania zalogowanego użytkownika (`userId`) z `deletedAt: null`, sort `updatedAt` malejąco.
- Wiersz: tytuł + fragment treści (bez wyszukiwania: początek treści).
- Wyszukiwanie po tytule i treści, regex bez rozróżniania wielkości liter, uruchamiane Enterem (query w URL, np. `?q=`).
- Przy wyszukiwaniu fragment wokół trafienia z podświetleniem.
- Pobierać tylko pola potrzebne liście (bez `notes`).

## Kryteria akceptacji

- Usunięte i cudze opowiadania nie pojawiają się w liście ani w wynikach.
- Fraza ze znakami specjalnymi regex nie powoduje błędu.
- Pusty stan listy i brak wyników mają komunikat.

## Testy

- Jednostkowe: escapowanie frazy regex; budowa fragmentu wokół trafienia (początek, środek, koniec treści, brak trafienia w treści – trafienie w tytule).
- Integracyjne (funkcja zapytania listy): sortowanie po `updatedAt`, pomijanie usuniętych i cudzych, wyszukiwanie case-insensitive w tytule i treści, fraza `(` / `.*` nie rzuca i szuka dosłownie, brak `notes` w wyniku.
- E2E `tests/e2e/list.spec.ts`: wyszukiwanie po Enterze, podświetlenie, komunikaty pustej listy i braku wyników; `bob` nie widzi opowiadań `alice`.
