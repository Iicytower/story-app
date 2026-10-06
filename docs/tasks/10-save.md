# 10 – Zapis: saveStory, autozapis, zabezpieczenia

Spec: „Edytor”, „Server Actions i Route Handlers”, „Uwagi implementacyjne”.

## Zakres

- Server Action `saveStory(id, title, content, notes, expectedUpdatedAt)`:
  - sesja → `UNAUTHORIZED`; brak/usunięte/cudze → `NOT_FOUND` (filtr zawsze z `userId`),
  - pusty tytuł → `EMPTY_TITLE`; duplikat → `DUPLICATE_TITLE`,
  - niepusta treść w bazie → pusta → `EMPTY_CONTENT`,
  - `updatedAt` w bazie nowszy niż `expectedUpdatedAt` → `CONFLICT` (atomowo: warunek w filtrze `updateOne`/`findOneAndUpdate`),
  - zapis trzech pól naraz, zwraca nowy `updatedAt`.
- Autozapis ~3 s po ostatnim naciśnięciu klawisza (tytuł, treść, notatki); Ctrl+S zapisuje od razu.
- Pusty tytuł → autozapis nie startuje.
- Stan zapisu: saving / saved / error + komunikat `message`; brak automatycznego ponawiania (kolejna zmiana = nowa próba).
- Ostrzeżenie `beforeunload` przy niezapisanych zmianach.
- Unikać równoległych zapisów (kolejny zapis czeka na poprzedni i używa świeżego `updatedAt`).

## Kryteria akceptacji

- Edycja w dwóch kartach → druga dostaje komunikat o konflikcie.
- Wyczyszczenie całej treści nie nadpisuje bazy.
- Pierwszy zapis niepustej treści nowego opowiadania działa.

## Testy

- Integracyjne `saveStory` (najważniejsze w projekcie – ryzyko utraty tekstu):
  - sukces zapisuje trzy pola i zwraca nowszy `updatedAt`,
  - `CONFLICT` przy starszym `expectedUpdatedAt`, dokument nietknięty,
  - `EMPTY_CONTENT`: niepusta → pusta odrzucona; pusta → niepusta OK; pusta → pusta OK,
  - `EMPTY_TITLE`, `DUPLICATE_TITLE` – nic nie zapisane (także treść),
  - usunięte i cudze → `NOT_FOUND`, brak sesji → `UNAUTHORIZED`,
  - dwa równoległe zapisy z tym samym `expectedUpdatedAt` → dokładnie jeden sukces.
- E2E `tests/e2e/save.spec.ts`:
  - wpisanie tekstu → status „Saved” po ~3 s → po przeładowaniu tekst jest,
  - Ctrl+S zapisuje od razu,
  - dwie karty (dwa `page` w jednym kontekście): zapis w drugiej → komunikat o konflikcie,
  - pusty tytuł → brak zapisu; po wpisaniu tytułu zapis treści,
  - zduplikowany tytuł → komunikat błędu,
  - wyczyszczenie treści → komunikat błędu, baza bez zmian,
  - `beforeunload` przy niezapisanych zmianach (obsługa `page.on('dialog')`).
