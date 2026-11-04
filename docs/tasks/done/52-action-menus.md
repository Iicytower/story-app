# 52 – Menu akcji (⋮) i przeciąganie zamiast strzałek

Zgłoszenie użytkownika (2026-11-04). W wielu miejscach obok siebie stoi kilka ikon z akcjami. Mają trafić do menu kontekstowego otwieranego przyciskiem z trzema kropkami: pozycje z ikoną i opisem (D55).

## Zakres

- `components/ui/dropdown-menu.tsx` (shadcn DropdownMenu na Radix z pakietu `radix-ui`). Przycisk otwierający: ikona pionowych kropek (`EllipsisVerticalIcon`), `aria-label` i tooltip (D53), zawsze widoczny. Usuwanie na końcu menu, czerwone, oddzielone separatorem.
- Dialogi otwierane z menu (tagi, przeniesienie, zmiana nazwy, usunięcie, import, eksport, nowy rozdział / folder / opowiadanie, potwierdzenie publikacji) dostają sterowane `open` / `onOpenChange` bez własnego przycisku i są renderowane obok menu, nie w nim.
- Wiersz rozdziału na stronie folderu: menu Tagi, Przenieś, Opublikuj / Cofnij publikację, — Usuń. Przed ⋮ nieklikalna ikona stanu publikacji (globus albo globus z kłódką, z tooltipem); rozdział publiczny w nieopublikowanym folderze pokazuje stan prywatny, jak dziś.
- Nagłówek folderu: wszystko w menu, w grupach: Nowy rozdział | Sortuj › (podmenu z opcjami) | Tagi, Zmień nazwę | Eksport, Import | Opublikuj / Cofnij publikację, Opublikuj wszystkie | — Usuń. Pasek z publicznym linkiem zostaje.
- Strona `/stories`: wszystko z nagłówka w menu: Nowe opowiadanie, Nowy folder | Sortuj › | Import.
- Wiersz folderu na `/stories`: ikona stanu publikacji i menu Tagi, Zmień nazwę, Opublikuj / Cofnij publikację, — Usuń.
- Górny pasek edytora: Eksport, Opublikuj / Cofnij publikację, — Usuń w menu; powrót do folderu, tytuł i status zapisu zostają, przycisk panelu bocznego zostaje na krawędzi panelu, pasek z publicznym linkiem zostaje.
- Wiersz wersji folderu: menu Przywróć (całą wersję, z potwierdzeniem) i — Usuń.
- Każda zmiana publikacji z menu ma dialog potwierdzenia.
- Bez menu: wyniki wyszukiwania na `/stories` i panel rozdziałów w edytorze są tylko nawigacją (znika usuwanie, a w panelu też strzałki).
- Strzałki ↑↓ znikają. Przy sortowaniu ręcznym lista folderów i lista rozdziałów na stronie folderu mają po lewej uchwyt do przeciągania (`@dnd-kit/core` + `@dnd-kit/sortable`): mysz, dotyk po przytrzymaniu 250 ms, klawiatura (spacja, strzałki, spacja). Nowe akcje `moveFolder(id, index)` i `moveChapter(id, index)`; stare `reorderFolder` / `reorderChapter`, `ReorderButtons`, `SortSelect` i ich klucze tekstów usunięte.

## Kryteria akceptacji

1. Opisane miejsca mają ⋮ z podanymi pozycjami (ikona + tekst w języku interfejsu), usuwanie czerwone na końcu za separatorem.
2. Każda pozycja otwiera ten sam dialog / wykonuje tę samą akcję co dawny przycisk; po zamknięciu dialogu strona dalej reaguje na kliknięcia.
3. Sortowanie wybiera się z podmenu „Sortuj”, aktywna opcja jest zaznaczona.
4. Zmiana publikacji z menu wymaga potwierdzenia; stan publikacji wiersza widać jako ikonę przed ⋮.
5. Wyniki wyszukiwania i panel rozdziałów w edytorze nie mają przycisków akcji.
6. Przy sortowaniu ręcznym przeciągnięcie uchwytu (mysz lub klawiatura) zmienia kolejność folderów i rozdziałów i zostaje po odświeżeniu; przy innym sortowaniu uchwytu nie ma.
7. Akcje przenoszenia odrzucają cudze id i niepoprawną pozycję, pozycję poza listą przycinają.
8. Dotyk: przeciąganie startuje po przytrzymaniu uchwytu, przewijanie listy palcem działa.

## Testy

- Integracyjne (`tests/integration/sorting.test.ts`): `moveFolder` / `moveChapter` – przeniesienie na pozycję, przycięcie indeksu, cudze id i niepoprawny indeks → błąd, tylko w obrębie folderu.
- E2E: menu w wierszu rozdziału (tagi, przeniesienie, publikacja z potwierdzeniem, usunięcie), w nagłówku folderu (sortowanie z podmenu, zmiana nazwy, usunięcie), na `/stories` (nowy folder, sortowanie), w wierszu folderu, w edytorze (eksport, publikacja, usunięcie), w wersjach (przywrócenie, usunięcie); klik w stronę po zamknięciu dialogu; brak akcji w wynikach wyszukiwania i panelu edytora; przeciąganie klawiaturą i myszą; teksty menu na `/pl`. Istniejące testy przechodzą przez menu.
- `manual`: przeciąganie dotykiem na telefonie (kryterium 8), wygląd menu w trybie jasnym i ciemnym.

## Uwagi

- Przy okazji naprawiony niestabilny test `wysiwyg.spec.ts` (Ctrl+K): skrót trafiał czasem przed `selectionchange`, zanim ProseMirror przepisał zaznaczenie z DOM do swojego stanu. Helper `selectToLineStart` czeka na to zdarzenie.
