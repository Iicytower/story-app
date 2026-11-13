# D49 – Przełącznik języka i język po zalogowaniu (2026-11-03)

Status: aktualna.

- Przełącznik „Language” w sidebarze to menu z listą języków, każdy nazwany we własnym języku (`LOCALE_NAMES` w `i18n/routing.ts`; decyzja użytkownika).
- Ustawienie `appearance.locale` zapisuje tylko akcja `changeLocale`, która ustawia też cookie `NEXT_LOCALE` na rok; `saveSettings` go nie przyjmuje. `null` = nie wybrano, język z cookie albo `Accept-Language`.
- Logowanie woła `signIn` z `redirect: false` i przekierowuje samo: na `callbackUrl` w języku z ustawienia (i ustawia cookie), a bez ustawienia w języku bieżącej strony. Auth.js nie sprawdza już `callbackUrl`, więc przed otwartym przekierowaniem chroni `withLocale`, które zostawia tylko ścieżkę i query.
- Ograniczenie: proxy nie czyta bazy. Na urządzeniu, które już jest zalogowane, zmiana języka zrobiona na innym urządzeniu działa dla adresów bez prefiksu dopiero po kolejnym zalogowaniu albo przełączeniu na tym urządzeniu.
- Strony publiczne mają `hreflang` dla każdego języka i `x-default` na adres bez prefiksu (zgodnie z D47; decyzja użytkownika). Adres bezwzględny z nagłówków żądania, więc produkcja i staging linkują do siebie.
