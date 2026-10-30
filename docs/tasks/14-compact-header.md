# 14 – Mniejszy górny pasek

Zgłoszenie użytkownika (2026-10-28): górny pasek z „Log out” zajmuje za dużo miejsca nad obszarem roboczym. Trzeba go zmniejszyć albo zlikwidować.

## Zakres

- Pasek w `app/(protected)/layout.tsx` (dziś `h-14`: link „Stories”, przełącznik motywu, „Log out”).
- Ustalenia z użytkownikiem: D29 w `decisions.md` (bez paska, menu konta na wszystkich stronach chronionych).
- „Log out”, przełącznik motywu i powrót do listy opowiadań pozostają dostępne z każdej strony chronionej.

## Kryteria akceptacji

1. Nad obszarem roboczym edytora nie ma górnego paska: edytor zaczyna się od góry okna.
2. Wylogowanie, zmiana motywu i przejście do „Stories” działają z każdej strony chronionej.
3. Działa na desktopie i wąskim ekranie (D12).

## Testy

- E2E: istniejące testy logowania/wylogowania i motywu zielone po zmianie lokalizacji przycisków (2); test wysokości paska / pozycji edytora względem góry viewportu (1); wariant mobilny (3).
