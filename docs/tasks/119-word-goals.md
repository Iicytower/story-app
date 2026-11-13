# 119 – Cele słów rozdziału

Model: opus

Subtask 108. Podstawa: [D85](../decisions/D085-poprawa-ux-ui-2.md) (cel rozdziału, bez celów sesji), raport (pozycja o celach słów). Branch `feature/119-word-goals` z `fix/ui-2`, merge do `fix/ui-2`. Zależy od 112.

## Zakres

- Opcjonalne pole `wordGoal` (liczba całkowita lub brak) na rozdziale (`Story`); walidacja w `lib/` zwraca klucz błędu (`ValidationError`), zakres 1–1 000 000 (spójnie z limitami danych z task 59); zapis przez Server Action z sesją, `userId` z sesji, odpowiedź `{ ok, … }` bez rzucania wyjątków.
- UI: ustawienie celu w stopce edytora (małe pole/popover obok licznika słów), pasek postępu (Radix `Progress` z `radix-ui`) z tekstem „N / cel słów”; bez celu – dotychczasowa stopka. Teksty w `messages/*.json` (plural ICU).
- Eksport/import i wersje: pole ignorowane lub zachowane tak, żeby nie psuć istniejących formatów; rozstrzygnięcie zapisać w D85.

## Kryteria akceptacji

1. Użytkownik ustawia, zmienia i usuwa cel słów rozdziału.
2. Pasek postępu odzwierciedla liczbę słów względem celu i nie przekracza 100% wizualnie.
3. Bez celu stopka wygląda jak dotąd.
4. Cudzy rozdział lub nieprawidłowa wartość → odrzucone (`NOT_FOUND`/błąd walidacji).
5. Eksport i import działają bez zmian.

## Testy

- Integracyjny: `word-goal.test.ts` – zapis, usunięcie, walidacja zakresu, cudzy rozdział (4). E2E: `word-goal.spec.ts` – ustawienie celu i pasek (1, 2, 3). Istniejące testy eksportu/importu zielone (5).
