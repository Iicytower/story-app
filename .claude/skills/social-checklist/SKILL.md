---
name: social-checklist
description: Checklist for code of the social system (tasks 68–91, D80) – permissions, visibility, bans and blocks, limits, markdown, notifications. Use when implementing, reviewing or auditing any social feature.
---

# Lista kontrolna systemu społecznościowego (D80)

Źródło prawdy: `docs/decisions.md` D80 i plik taska. Przy każdej akcji i każdym odczycie sprawdź:

1. **Sesja i właściciel**: `requireUser()`, `userId` z sesji, guardy D71, wynik `{ ok, ... }` bez wyjątków.
2. **Uprawnienia** tylko przez `lib/social/permissions.ts` (`canInteract`, `hiddenAuthorsFor` itp.): ban w społeczności autora, ban globalny (tylko odczyt), blokada w obie strony, wyłączone komentarze, rola (admin, moderator autora, moderator kategorii), ustawienie DM „kto może pisać”. Nigdy warunek tylko w komponencie.
3. **Widoczność** przy odczycie: obiekt publiczny wg D38 (folder `published`, rozdział `public`, oba bez `deletedAt`), treści zbanowanych globalnie i zablokowanych przez widza odfiltrowane, prywatna biblioteka niewidoczna, oceny anonimowe (nigdy `userId` oceniającego w odpowiedzi).
4. **Cudze / niewidoczne → `NOT_FOUND`**, także dla moderacji poza swoją społecznością.
5. **Limity**: długości z `lib/limits.ts`, antyspam per konto (`takeUserAttempt`, połowa dla konta < 24 h), limity liczby (półki, zakładki, moderatorzy, wzmianki).
6. **Markdown** przez `components/social-markdown.tsx` (allowlista elementów, bez `rehype-raw`, linki `nofollow ugc noopener`).
7. **Powiadomienia i aktywność** przez wspólne helpery (task 81, `recordActivity`), z pominięciem zablokowanych i wyłączonych rodzajów.
8. **Zapytania** z indeksem i limitem wyników; liczniki bez pobierania całych kolekcji.
9. **i18n**: każdy tekst w `messages/en.json` i `pl.json`, ICU dla liczby mnogiej, daty względne przez `Intl`.
10. **Testy**: każdy przypadek bana, blokady i bana globalnego osobno; izolacja użytkowników; gość (odczyt tak, zapis → dialog logowania).
