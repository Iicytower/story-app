# 06 – Layout, nagłówek, dark mode

Spec: „Cel i stack”, „Logowanie”.

## Zakres

- Wspólny layout dla stron chronionych z nagłówkiem: link do listy, przełącznik motywu, przycisk „Log out”.
- Jasny/ciemny motyw (Tailwind `dark:`), wybór zapamiętany w przeglądarce, bez migania przy ładowaniu.
- Layout desktopowy (bez wersji mobilnej).

## Kryteria akceptacji

- Przełączenie motywu przetrwa odświeżenie strony.
- Wylogowanie wraca na `/login`.

## Testy

- E2E `tests/e2e/layout.spec.ts`: przełączenie motywu → klasa `dark` na `<html>` po przeładowaniu nadal obecna; „Log out” → `/login`, a `/stories` znów przekierowuje.
- `manual`: brak mignięcia złego motywu przy ładowaniu.
