# 05 – Panele edytora: notatki folderu i rozdziały

Zależy od 03. Nowy pakiet: shadcn Resizable (`react-resizable-panels`), zgoda użytkownika przed startem.

## Zakres

- **Układ desktop:** [Story] | [panel boczny] z przeciąganymi separatorami (shadcn Resizable).
  - Panel boczny ma przełącznik **Notes / Chapters**.
  - Przycisk „Split” rozbija panel na dwie kolumny: [Story] | [Notes] | [Chapters].
  - Kolejność kolumn zmieniają przyciski „Move left” / „Move right” w nagłówku kolumny.
  - Każdą boczną kolumnę da się zwinąć. Wtedy Story zajmuje całą szerokość, a przycisk rozwijania zostaje przy krawędzi.
- **Notes:** podział poziomy z przeciąganym separatorem. Na górze notatki folderu, na dole notatki rozdziału. Oba pola mają osobny autozapis i osobny stan zapisu. Notatki folderu korzystają z kontroli konfliktu z tasku 02 (`notesUpdatedAt`).
- **Chapters:** lista rozdziałów folderu w kolejności z `chapterSort`, bieżący rozdział wyróżniony.
  - Kliknięcie przechodzi do rozdziału. Przed przejściem wymuszany jest zapis bieżącego (kolejka autozapisu), a przy błędzie zapisu przejście się nie odbywa i pokazuje się komunikat.
  - „New chapter” (dialog z tytułem).
  - Move up / down w trybie manual.
  - „Delete” z potwierdzeniem; usunięcie bieżącego rozdziału przenosi do widoku folderu.
- Układ zapisywany w `localStorage` (try/catch, działa bez niego): split, kolejność kolumn, szerokości, wysokość podziału Notes, zwinięcia.
- **Mobile (< `md`, zmiana D12):** zakładki Story / Notes / Chapters, jeden panel naraz. W Notes notatki folderu nad notatkami rozdziału, bez separatora.
- Ostrzeżenie przy zamykaniu karty obejmuje też niezapisane notatki folderu.
- Aktualizacja D12 w `decisions.md`.

## Kryteria akceptacji

1. Separatory zmieniają szerokości i wysokość podziału Notes, a układ przetrwa przeładowanie.
2. Split pokazuje Notes i Chapters jednocześnie. Kolejność kolumn można zmienić, kolumny boczne można zwinąć i rozwinąć.
3. Notatki folderu i rozdziału zapisują się niezależnie. Zmiana notatek folderu widoczna w innym rozdziale tego folderu po jego otwarciu.
4. Edycja notatek folderu w dwóch kartach (dwa rozdziały) → druga karta dostaje komunikat o konflikcie. Autozapis treści rozdziału nie powoduje konfliktu notatek folderu.
5. Chapters: przejście z zapisem bieżącego rozdziału, przy błędzie zapisu brak przejścia. Dodanie, zmiana kolejności, usunięcie.
6. Mobile: trzy zakładki, każda pokazuje właściwy panel.
7. Bez `localStorage` (wyjątek przy dostępie) edytor działa z układem domyślnym.

## Testy

- Jednostkowe: odczyt i zapis układu z `localStorage` z obsługą wyjątków (1, 7), operacje na kolejności kolumn (2).
- E2E: separator i przeładowanie (1), split, kolejność i zwijanie (2), notatki folderu w dwóch rozdziałach (3), konflikt w dwóch kartach (4), panel Chapters (5), viewport mobilny (6).
