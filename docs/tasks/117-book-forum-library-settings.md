# 117 – Książka, forum, biblioteka, ustawienia

Model: sonnet

Subtask 108. Podstawa: [D85](../decisions/D085-poprawa-ux-ui-2.md), raport (A9, A12, A13, A14), backlog (pasek notatek, półki). Branch `feature/117-book-forum-library-settings` z `fix/ui-2`, merge do `fix/ui-2`. Zależy od 111.

## Zakres

- `/books/[id]`: status „Publiczny/Prywatny” jako badge z akcją opublikuj/cofnij publikację (to samo co w menu „⋮”); panel notatek niższy, tekst od góry; „Wersje” wyżej. Pasek narzędzi notatek książki i rozdziału jako nakładka albo w jednym wierszu, żeby nie rezerwował ~67 px nad tekstem.
- Ustawienia → Profil: awatar osobno od „Zapisz »O mnie«” i „Zobacz profil”; wyższy kontrast nieaktywnych zakładek i przycisku „Zapisz” w ciemnym motywie; „Avatar” → „Awatar” (pl).
- Wątek forum: pasek akcji wyrównany z treścią („Cytuj”), przycisk reakcji z widoczną etykietą/tooltipem i `aria-label`, wyższy kontrast breadcrumbu.
- `/forums`: opisy kategorii i badge nieprzeczytanych/liczby wątków; pusta kategoria wizualnie odróżniona. `/library`: okładki pozycji, jaśniejsza etykieta „Czytaj dalej” obok „N nowe rozdziały”; domyślne półki (Czytam, Na później, Przeczytane) tłumaczone z językiem UI.

## Kryteria akceptacji

1. Status książki można zmienić z poziomu strony książki bez menu „⋮”.
2. Notatki nie rezerwują pustego paska nad tekstem; sekcja „Wersje” jest wyżej niż dotąd.
3. W ustawieniach Profil akcje nie są pomieszane z awatarem.
4. Przycisk reakcji ma nazwę dostępną i etykietę.
5. Kategorie for mają opisy i liczniki; biblioteka okładki.
6. Domyślne półki zmieniają nazwę z językiem UI.

## Testy

- E2E: `books.spec.ts` (1, 2), `settings.spec.ts` (3), `forums.spec.ts` (4, 5), `library.spec.ts` (5, 6). Półki (6): test integracyjny, że nazwa domyślnej półki jest kluczem, nie tekstem zapisanym w bazie, albo migracja zgodnie z D14 – zapisać wybór w D85.
