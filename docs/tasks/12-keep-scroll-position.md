# 12 – Pozycja przewijania przy przełączaniu widoków

Zgłoszenie użytkownika (2026-10-28): przełączenie Preview/Source w edytorze albo Notes/Chapters w panelu bocznym przewija obszar roboczy na górę. Widok ma zostać w tym samym miejscu.

## Zakres

- Preview ↔ Source (`components/markdown-editor.tsx`): po przełączeniu widoczny jest ten sam fragment tekstu co przed nim. Dwa widoki mają różną wysokość treści, więc samo przepisanie `scrollTop` nie wystarczy – do ustalenia przy starcie: proporcja przewinięcia czy dopasowanie po pozycji kursora / akapicie.
- Notes ↔ Chapters (panel boczny w `editor.tsx`, desktop i mobile): każda zakładka pamięta swoją pozycję przewijania w obrębie sesji edytora; przełączenie nie przewija edytora treści ani strony.
- Pozycja nie jest zapisywana w bazie ani w ustawieniach, tylko w `localStorage` per rozdział (rozszerzenie zakresu 2026-10-30): treść, notatki rozdziału i folderu oraz lista rozdziałów. Przeładowanie, Split i Hide/Show jej nie gubią. Pamiętane jest 50 ostatnich rozdziałów, nie dłużej niż 30 dni.

## Kryteria akceptacji

1. Przewinięcie treści w Preview i przełączenie na Source (i z powrotem) pokazuje ten sam fragment tekstu, a nie początek.
2. Przełączenie Notes ↔ Chapters nie zmienia przewinięcia edytora treści.
3. Powrót do zakładki Notes lub Chapters przywraca jej poprzednie przewinięcie.
4. Działa na desktopie i na wąskim ekranie (D12).
5. Po przeładowaniu strony oraz po Split i Hide/Show treść, notatki i lista rozdziałów wracają do poprzedniego przewinięcia.
6. Pozycje starsze niż 30 dni i spoza 50 ostatnio zapisanych rozdziałów są zapominane.

## Testy

- E2E: długi rozdział, przewinięcie, przełączenie Preview/Source – fragment widoczny przed przełączeniem jest w viewporcie po nim (1); `scrollTop` edytora bez zmian po Notes ↔ Chapters (2); `scrollTop` zakładki przywrócony po powrocie (3); wariant z viewportem mobilnym (4); przeładowanie przywraca blok na górze treści i notatek oraz `scrollTop` listy, Split i Hide zachowują blok treści (5).
- Unit: parsowanie zapisu z `localStorage` (odrzucanie błędnych wpisów) i wygaszanie po 30 dniach i ponad 50 rozdziałów (6).
