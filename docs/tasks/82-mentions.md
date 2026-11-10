# 82 – Wzmianki @nick

Subtask 68, zależy od 81. Podstawa: D80 (Interakcje z tekstem – wzmianki). Branch `feature/82-mentions` z `feature/social`, merge do `feature/social`.

## Zakres

- `lib/social/mentions.ts`: wyciąganie `@nick` (regex nicku z D37, poza kodem i linkami markdownu), najwyżej 10 wzmianek na treść.
- Render: wtyczka remark w `SocialMarkdown` zamienia wzmiankę istniejącego, niezablokowanego użytkownika na `UserLink`; pozostałe zostają tekstem. Rozstrzygnięcie nicków jednym zapytaniem przy odczycie listy.
- Powiadomienie `mention` (grupa rozmowy) przy dodaniu komentarza (76), posta (87) i DM (85, tylko gdy wspomniany jest stroną rozmowy – inaczej pomijane); edycja nie powiadamia drugi raz tych samych osób. `canInteract(kind: "mention")`: blokada → bez linku i bez powiadomienia.
- Podpowiedzi nicków w textarea po wpisaniu `@` (`cmdk`, akcja `suggestNicknames(prefix)`: najwyżej 8, z collation D37, bez kont zablokowanych w obie strony i usuniętych, limit `SOCIAL_LIMITS.suggest`, 60/min).
- Komentarze (76): wzmianki podpiąć w `addComment`, `replyToComment` i `editComment` (`app/[locale]/p/[nickname]/[folder]/comment-actions.ts`).

## Kryteria akceptacji

1. Wzmianka istniejącego użytkownika linkuje do profilu i daje mu powiadomienie.
2. Nieistniejący nick zostaje tekstem; blokada → bez linku i powiadomienia.
3. Edycja nie duplikuje powiadomień.
4. Podpowiedzi zwracają pasujące nicki bez zablokowanych.

## Testy

- Unit: `lib/social/mentions.test.ts` (wyciąganie, kod, linki, limit 10).
- Integracyjne: `tests/integration/mentions.test.ts` (1–4).
- E2E: `tests/e2e/mentions.spec.ts` (`dave` pisze `@erin` z podpowiedzi, `erin` dostaje powiadomienie, link działa).
