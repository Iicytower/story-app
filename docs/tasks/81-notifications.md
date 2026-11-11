# 81 – Powiadomienia

Subtask 68, zależy od 71, 72, 73, 76, 77, 78, 79 i 80. Podstawa: D80 (Powiadomienia, DM, realtime – powiadomienia i polling). Branch `feature/81-notifications` z `feature/social`, merge do `feature/social`.

## Zakres

- Kolekcja `notifications` (`userId`, `type`, `group: interactions | conversations | chapters | moderation`, `objectKey` (do grupowania, np. `reaction:story:<id>`), `actorIds` (ostatni do 5), `count`, `readAt?`, `createdAt`, `updatedAt`, TTL 90 dni na `updatedAt`). Bez pola `targetUrl`: adres z `type` i id celu przy odczycie. Indeks `{ userId, readAt, updatedAt: -1 }`. Najwyżej 500 na użytkownika (przy wstawianiu usuwane najstarsze ponad limit).
- `notify(userId, event)` w `lib/social/notify.ts`: pomija siebie, blokadę w dowolną stronę i wyłączony rodzaj; reakcje i oceny tego samego obiektu łączy w jedno nieprzeczytane powiadomienie (`count`, `actorIds`). Wywołania podpięte w istniejących akcjach: komentarz i odpowiedź (76), reakcja (77), ocena (78), obserwowanie (71), dodanie do biblioteki (72), nowy rozdział w bibliotece i od obserwowanego (publikacja, 73), zaproszenie na moderatora z akceptacją z powiadomienia, ban, ukrycie (79), zgłoszenie i jego wynik (80). Rodzaje forów i wzmianek dochodzą w 82 i 87.
- Nowy rozdział: hak w `stampPublishedAt` (`lib/publish/mutations.ts`) – rozdziały dostające `publishedAt` odczytać przed `updateMany` (ten sam filtr), bo po nim nie da się ich odróżnić od wcześniej opublikowanych. Od 75 `stampPublishedAt` już zwraca listę faktycznie ostemplowanych id (wspólny `stamp`, odczyt po `publishedAt: stamp`, odporne na równoległe publikacje) – użyć jej zamiast osobnego odczytu; publikacja książki (kilku rozdziałów naraz) = jedno powiadomienie z liczbą rozdziałów, jak wpis feedu.
- Powiadomienia do wielu odbiorców (nowy rozdział, obserwowany wątek w 87) wysyłane w `after()` partiami po 500 przez `bulkWrite`; błąd tylko w logach.
- Ustawienia (dialog D50, kolekcja `settings`): przełącznik każdego rodzaju, pogrupowane w cztery grupy; moderacja bez przełącznika.
- UI: dzwonek w sidebarze z licznikiem nieprzeczytanych, panel listy (sheet) z „Oznacz wszystkie jako przeczytane”, kliknięcie oznacza i przechodzi do celu. Polling: licznik co 30 s tylko przy widocznej karcie (`visibilitychange`), przez lekką akcję `unreadCounts` (zwraca też licznik DM dla 85). Toast `sonner` przy nowym powiadomieniu w czasie sesji.
- Pozycja „Powiadomienia” w sidebarze włączona.
- Komentarze (76): haki w `addComment`, `replyToComment` i `editComment` (`app/[locale]/p/[nickname]/[folder]/comment-actions.ts`).
- Reakcje (77): hak w `react` (`app/[locale]/p/[nickname]/[folder]/reaction-actions.ts`) po upsercie; powiadomienie tylko o nowej reakcji, nie o zmianie – trzeba przechwycić wynik upsertu (`upsertedCount`), dziś nieprzechwytywany. Ta sama reakcja niczego nie zmienia (`react` idempotentne).
- Oceny (78): hak w `rate` (`app/[locale]/p/[nickname]/[folder]/rating-actions.ts`) po upsercie; wynik upsertu (nowa vs zmieniona ocena) dziś nieprzechwytywany. Ta sama wartość niczego nie zmienia (także `updatedAt`).

## Kryteria akceptacji

1. Każde zdarzenie z zakresu tworzy powiadomienie u właściwej osoby, nie u sprawcy.
2. Reakcje i oceny tego samego obiektu grupują się w jedno nieprzeczytane („N osób…”).
3. Wyłączony rodzaj nie tworzy powiadomień; moderacji nie da się wyłączyć.
4. Blokada w dowolną stronę wstrzymuje powiadomienia między stronami.
5. Licznik i lista; oznaczanie przeczytanych; izolacja: cudze powiadomienia niedostępne.
6. Limit 500 i TTL 90 dni.
7. Polling co 30 s tylko przy widocznej karcie.

## Testy

- Unit: `lib/social/notify.test.ts` (grupowanie, klucze obiektów).
- Integracyjne: `tests/integration/notifications.test.ts` (1–6).
- E2E: `tests/e2e/notifications.spec.ts` (`dave` komentuje, `alice` widzi licznik po pollingu z `page.clock`, panel, przejście; 3 – wyłączenie w ustawieniach; 7 – `visibilityState` emulowany przez `Object.defineProperty(document, "visibilityState", { value: "hidden" })` i `dispatchEvent(new Event("visibilitychange"))` w `page.evaluate`).
