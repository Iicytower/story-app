# 43 – Routing z prefiksem języka

Zgłoszenie użytkownika (2026-11-03). Pierwszy z trzech tasków wielojęzycznego interfejsu (D46): tu tylko routing, bez zmian w tekstach. Słowniki: task 44, przełącznik i polski: task 45.

## Zakres

- Instalacja `next-intl` (zgoda w D46) i konfiguracja zgodna z Next 16 i `proxy.ts` – API sprawdzić w aktualnej dokumentacji (context7) i w `node_modules/next/dist/docs/`.
- Lista języków w jednym miejscu (na razie tylko `en`, `pl` dochodzi w tasku 45), domyślny `en`, prefiks zawsze.
- Przeniesienie stron pod `app/[locale]/`: strona główna, `(protected)`, `auth`, `p/[nickname]`. `app/api/` zostaje poza prefiksem.
- `proxy.ts`: wykrywanie języka i przekierowanie wejścia bez prefiksu złożone z autoryzacją Auth.js. `lib/auth/public-paths.ts` rozpoznaje ścieżki z prefiksem, `pages.signIn` i `callbackUrl` zachowują język.
- Linki, `redirect`, `router.push`/`replace` i `revalidatePath` przez helpery świadome języka (`next-intl` navigation).
- `<html lang>` według języka z adresu.

## Ustalenia

- Kolejność wykrywania (D46): ustawienie użytkownika, cookie, `Accept-Language`, `en`. Proxy nie czyta bazy: ustawienie trafia do cookie przy logowaniu i przy zmianie (zapis ustawienia w tasku 45, tu tylko cookie i `Accept-Language`).
- Stare adresy bez prefiksu (zakładki, udostępnione `/p/nick/folder/rozdział`) przekierowują na wersję z prefiksem, z zachowaniem ścieżki i query.
- Język z adresu, którego nie ma na liście, daje 404.

## Kryteria akceptacji

1. Wszystkie strony działają pod `/en/...`, a wygląd i teksty się nie zmieniają.
2. Wejście bez prefiksu (np. `/stories`, `/p/nick/folder`) przekierowuje na `/en/...` z tą samą ścieżką i query.
3. Niezalogowany na chronionej stronie trafia do dialogu logowania, a po zalogowaniu wraca na tę samą stronę z prefiksem.
4. Linki, przekierowania po akcjach (np. utworzenie i usunięcie opowiadania, logowanie, wylogowanie) zachowują prefiks.
5. Eksport i `/api/auth` działają bez prefiksu.
6. Nieznany język w adresie (np. `/xx/stories`) daje 404.
7. `<html lang>` odpowiada językowi z adresu.

## Testy

Unit: `isPublicPath` dla ścieżek z prefiksem, wybór języka z cookie i `Accept-Language`. E2E: przekierowanie bez prefiksu (strona chroniona i publiczna, z query), powrót po zalogowaniu, eksport, 404 dla nieznanego języka, `lang`; poprawione asercje `toHaveURL`/`waitForURL` w istniejących testach. `manual`: stare publiczne linki na stagingu.
