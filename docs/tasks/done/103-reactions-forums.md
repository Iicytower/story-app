# 103 – Reakcje i fora

Subtask 51. Podstawa: [D83](../../decisions/D083-poprawa-ux-ui.md) i raport [`docs/ui-ux-report.md`](../../ui-ux-report.md) (numery punktów w nawiasach). Branch `feature/103-reactions-forums` z `fix/ui`, merge do `fix/ui`. Użyj skilla `social-checklist`.

## Zakres

- Reakcje (`app/[locale]/p/[nickname]/[folder]/reaction-bar.tsx` i użycia przy komentarzach i postach): widoczne tylko reakcje z licznikiem > 0 (klik przełącza moją reakcję, licznik otwiera listę nicków jak dotychczas) i jeden przycisk „Dodaj reakcję” z popoverem sześciu emoji; łączny licznik usunięty (6.3; D80 `text-interactions.md` zmieniona w D83). Gość widzi użyte reakcje; „Dodaj reakcję” u gościa otwiera dialog logowania (D42). Autor nie widzi „Dodaj reakcję” pod własnym tekstem.
- Fora – lista kategorii: pod nazwą linia meta „N wątków · ostatni post <czas względny>” (liczba i data z widocznych wątków, z uwzględnieniem blokad i ukryć jak lista wątków) (6.1).
- Fora – kategoria: formularz nowego wątku schowany za przyciskiem „Nowy wątek” (6.2).

## Kryteria akceptacji

1. Pod tekstem bez reakcji jest tylko „Dodaj reakcję”; po reakcji widać jej emoji z licznikiem; łącznego licznika nie ma.
2. Uprawnienia reakcji bez zmian (ban, blokada, autor, niepubliczny obiekt).
3. Lista kategorii pokazuje liczbę wątków i ostatnią aktywność zgodne z bazą.
4. Formularz nowego wątku jest ukryty do kliknięcia „Nowy wątek”.

## Testy

- Integracyjne: `tests/integration/forums.test.ts` – liczniki kategorii (3, z wątkiem ukrytym/usuniętym i blokadą); `reactions.test.ts` bez zmian (2).
- E2E: `reactions.spec.ts` (1, gość), `forums.spec.ts` (3, 4).
