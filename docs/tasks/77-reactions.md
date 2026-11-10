# 77 – Reakcje

Subtask 68, zależy od 76. Podstawa: D80 (Interakcje z tekstem – reakcje). Branch `feature/77-reactions` z `feature/social`, merge do `feature/social`.

## Zakres

- Stała `REACTIONS = ["heart", "laugh", "wow", "sad", "fire", "clap"]` (❤️ 😂 😮 😢 🔥 👏) w `lib/social/reactions.ts`; etykiety dostępności w `messages/*`.
- Kolekcja `reactions` (`userId`, `targetType: story | comment | post`, `targetId`, `authorId` (właściciel obiektu), `reaction`, `createdAt`; unikalny `{ userId, targetType, targetId }`, indeks `{ targetType, targetId }`). Mechanizm wspólny, `post` używany w 87.
- Akcja `react(targetType, targetId, reaction | null)`: wybór innej nadpisuje, ta sama lub `null` zdejmuje. `canInteract(kind: "react")`, limit 60/min, obiekt widoczny (D38, komentarz nieukryty). Autor nie reaguje na swój rozdział.
- UI: pasek reakcji pod rozdziałem i przy komentarzu z licznikami; klik w licznik otwiera listę nicków (popover, zablokowani przez widza pominięci). Gość widzi liczniki.
- Hak dla powiadomień (81, grupowanie) i statystyk (83).

## Kryteria akceptacji

1. Jedna reakcja na obiekt od użytkownika; zmiana nadpisuje, ponowny klik zdejmuje.
2. Liczniki i lista nicków zgodne z bazą; gość widzi liczniki.
3. Ban, ban globalny i blokada odrzucają reakcję; autor nie reaguje na swój tekst.
4. Reakcje niepublicznego obiektu niewidoczne i niezapisywalne; po ponownej publikacji wracają.

## Testy

- Unit: `lib/social/reactions.test.ts` (walidacja klucza).
- Integracyjne: `tests/integration/reactions.test.ts` (1–4, unikalny indeks przy równoległych żądaniach).
- E2E: `tests/e2e/reactions.spec.ts` (`dave` i `erin` reagują na rozdział i komentarz, lista nicków).
