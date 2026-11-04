# 46 – Dialog ustawień zamiast osobnych pozycji w sidebarze

Zgłoszenie użytkownika (2026-11-03). Opcje konta i wyglądu przechodzą z sidebaru do jednego dialogu „Settings” (D50).

## Zakres

- Pozycja „Settings” w sidebarze (ikona, etykieta, tryb zwinięty i szuflada na wąskim ekranie) otwiera dialog ustawień.
- Z sidebaru znikają „Toggle theme”, „Language”, „Change password” i „Log out”. Zostają Home, Search, Folders i zwijanie sidebaru.
- Sekcje dialogu:
  - Wygląd: motyw jako wybór jasny / ciemny / systemowy (`appearance.theme`, `null` = systemowy). Zmiana działa od razu, bez przeładowania, i zapisuje się jak dziś.
  - Język: English / Polski, to samo zachowanie co przełącznik z taska 45 (`changeLocale`, ten sam adres w nowym języku).
  - Konto: zmiana hasła (formularz z dzisiejszego dialogu) i wylogowanie.
- Teksty w `messages/en.json` i `messages/pl.json`.

## Ustalenia

- Dialog, nie osobna strona (decyzja użytkownika): bez nowego adresu, jak dziś zmiana hasła.
- Usuwamy tylko pozycje sidebaru; akcje (`saveSettings`, `changeLocale`, `changePassword`, `logout`) zostają bez zmian.
- Wybór „systemowy” to nowość: dziś przełącznik zna tylko jasny i ciemny.
- Listy rozwijane, wspólne „Save” (aktywne tylko po zmianie) i „Cancel”, bez podglądu; po zapisie dialog zostaje otwarty; zmiana hasła jako osobny widok dialogu z własnym „Save” (decyzje użytkownika, D50).

## Kryteria akceptacji

1. Sidebar ma pozycję „Settings” i nie ma już Toggle theme, Language, Change password ani Log out (także zwinięty i w szufladzie).
2. „Settings” otwiera dialog z sekcjami Wygląd, Język i Konto.
3. Motyw jasny, ciemny i systemowy działa od razu i zostaje po przeładowaniu.
4. Zmiana języka w dialogu działa jak w tasku 45: ten sam adres i query w nowym języku, ustawienie i cookie zapisane.
5. Zmiana hasła i wylogowanie działają z dialogu jak dotąd.
6. Dialog jest w pełni po angielsku i po polsku.

## Testy

E2E: sidebar bez starych pozycji, otwarcie dialogu, motyw (trzy opcje, po przeładowaniu), zmiana języka, zmiana hasła i wylogowanie z dialogu; poprawione testy i helper `sidebarAction`, które dziś klikają te pozycje w sidebarze (`layout`, `change-password`, `polish`, `settings`). Integracyjne: zapis `appearance.theme: null` przez `saveSettings`. `manual`: wygląd dialogu w trybie jasnym i ciemnym, na wąskim ekranie.
