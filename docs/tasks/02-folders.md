# 02 – Foldery

Każde opowiadanie (rozdział) należy do dokładnie jednego folderu. Foldery mają jeden poziom, bez zagnieżdżeń. Zależy od 01.

## Zakres

- Kolekcja `folders`: `userId`, `name`, `notes` (domyślnie `""`), `notesUpdatedAt` (kontrola konfliktu notatek), `lastActivityAt` (sortowanie listy), `deletedAt` (domyślnie `null`), `createdAt`, `updatedAt`. Unikalny indeks częściowy `{ userId, name }` z filtrem `deletedAt: null`.
- `stories` dostaje `folderId` (wymagane). Unikalność tytułu zmienia się z `{ userId, title }` na `{ userId, folderId, title }` (ten sam filtr częściowy).
- Migracja `002-folders`: każdy użytkownik z opowiadaniami dostaje folder „Unsorted”, wszystkie jego opowiadania trafiają do niego. Stary indeks usuwa `syncIndexes()` (task 01). Kopia: `stories`.
- Ryzyko w oknie builda: stary kod (v1.0) może w tym czasie utworzyć opowiadanie bez `folderId`. Migracja jest idempotentna i przy każdym uruchomieniu przypisuje takie opowiadania do „Unsorted”, więc naprawi je kolejny deploy. Dopisujemy to w `deploy.md`.
- **Pola czasu:**
  - `lastActivityAt` folderu ustawiają: zapis rozdziału, zapis notatek folderu, utworzenie i przeniesienie rozdziału.
  - Kontrola konfliktu notatek folderu opiera się wyłącznie na `notesUpdatedAt`, więc autozapis rozdziału nigdy nie wywoła `CONFLICT` w notatkach.
  - Operacje „organizacyjne” nie zmieniają `updatedAt` opowiadania (`timestamps: false`, jak w D11): przeniesienie, zmiana nazwy folderu, usunięcie folderu. Dzięki temu otwarty edytor nie dostaje `CONFLICT`.
- **`/stories`:** lista folderów (nazwa, liczba rozdziałów, data ostatniej aktywności), sortowana po `lastActivityAt` malejąco (tryby sortowania w tasku 03). Przyciski „New folder” i „New story” (dialog: tytuł + select folderu). Wyszukiwanie globalne jak teraz (tytuł i treść), wynik pokazuje też nazwę folderu.
- **`/folders/[id]`:**
  - lista rozdziałów: tytuł, fragment, data;
  - akcje przy wierszu: „Move to…” (select folderu, rozdział trafia na koniec), „Delete” (soft delete z potwierdzeniem);
  - „New story”;
  - akcje folderu: „Rename” (duplikat → `DUPLICATE_NAME`) i „Delete” (soft delete folderu i jego rozdziałów, potwierdzenie z liczbą rozdziałów);
  - notatki folderu: textarea z autozapisem i kontrolą konfliktu, komunikaty jak w edytorze. Docelowy edytor wchodzi w tasku 06.
- Edytor: link powrotny do folderu. Panel Chapters dochodzi w tasku 05.
- Izolacja użytkowników (D1) dla wszystkich nowych akcji i stron: cudzy folder → `NOT_FOUND`/404. Nie da się przenieść rozdziału do cudzego folderu.
- Eksport pojedynczego `.md` i udostępnianie opowiadania bez zmian.
- Aktualizacja `docs/spec.md` (model danych, indeksy) na prośbę lub decyzja w `decisions.md`.

## Kryteria akceptacji

1. Migracja tworzy „Unsorted” per użytkownik i przypisuje mu wszystkie jego opowiadania. Drugie uruchomienie niczego nie zmienia, a opowiadanie bez `folderId` dodane później trafia do „Unsorted”.
2. Ten sam tytuł działa w dwóch różnych folderach. Duplikat w jednym folderze → `DUPLICATE_TITLE`. Usunięte rozdziały nie blokują tytułu.
3. Nazwa folderu unikalna u użytkownika (`DUPLICATE_NAME`). Usunięte foldery nie blokują nazwy.
4. Tworzenie, zmiana nazwy i usuwanie folderu. Usunięcie ukrywa folder i jego rozdziały na liście, w wyszukiwaniu, w edytorze (404) i na stronie publicznej (404).
5. Tworzenie rozdziału z `/stories` (wybór folderu) i z `/folders/[id]`.
6. Przeniesienie rozdziału do innego folderu. Kolizja tytułu w docelowym folderze → `DUPLICATE_TITLE`. Przeniesienie nie zmienia `updatedAt` rozdziału.
7. Autozapis rozdziału aktualizuje `lastActivityAt` folderu, ale nie zmienia `notesUpdatedAt`. Zapis notatek folderu po autozapisie rozdziału nie zwraca `CONFLICT`.
8. Notatki folderu: autozapis i `CONFLICT` przy zapisie z nieaktualnym `notesUpdatedAt`.
9. Wyszukiwanie globalne pokazuje nazwę folderu przy wyniku.
10. Izolacja: każda nowa akcja i strona dla cudzego folderu/rozdziału → `NOT_FOUND`/404.

## Testy

- Integracyjne: migracja `002` (1), akcje folderów i rozdziałów (2–8, 10), zapytanie wyszukiwania (9).
- E2E: utworzenie folderu → rozdział → przeniesienie → usunięcie folderu (4–6). Notatki folderu z autozapisem (8).
