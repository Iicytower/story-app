# 06 – Lista opowiadań i wyszukiwanie

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
