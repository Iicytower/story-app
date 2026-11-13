# D67 – Oznaczenie 18+ (2026-11-09)

Status: aktualna. Częściowo zmieniona w D80 (18+ admina).

- Task 65 (subtask 66), decyzje użytkownika. Pole `adult: { manual?, auto? }` na folderze i rozdziale (wspólny typ `AdultMark` w `lib/adult/adult.ts`, ten sam dla obrazków w tasku 26). `manual` ustawia właściciel, `auto` filtr obrazków. Brak pola to nie 18+, więc bez pliku migracji.
- Dziedziczenie: folder 18+ czyni 18+ wszystkie swoje rozdziały (wyliczane przy odczycie, `chapterAdultState`); rozdział 18+ nie oznacza folderu. Przeniesiony rozdział zachowuje własne `manual` i dziedziczy z nowego folderu.
- Blokada: zdjęcie 18+ zwraca `ADULT_LOCKED`, gdy jest `auto` (obrazek) albo, dla rozdziału, gdy folder jest 18+. Zdjęcie `auto` (usunięcie lub wymiana obrazka) zostawia `manual`, jeśli było.
- Przełącznik: pozycja „Oznacz jako 18+” / „Zdejmij 18+” w menu ⋮ (wiersz i nagłówek folderu, wiersz rozdziału, edytor) z potwierdzeniem w dialogu; zablokowana pozycja jest wyłączona i pokazuje powód.
- Znaczek 18+: lista folderów, wyniki wyszukiwania `/stories`, strona folderu, edytor, publiczny spis, strona czytania, wyszukiwarka i ostatnio opublikowane. W publicznym spisie folderu 18+ znaczek tylko przy nazwie folderu.
- Strona czytania rozdziału 18+ pokazuje zamiast treści ostrzeżenie („Mam ukończone 18 lat” / „Wróć” do spisu); odpowiedź w cookie `adult-confirmed` na rok. Bez filtra w wyszukiwarce.
- Zmiana oznaczenia nie zmienia `updatedAt` ani `lastActivityAt` (jak D11). Oznaczenie nie trafia do eksportu ani do wersji folderów (D25).
- Oznaczenie przez admina (task 88, D80): `AdultMark.admin` (folder, rozdział) i `adminAdult` (okładka); `true` wymusza 18+, `false` je zdejmuje mimo `manual`/`auto`; szczegóły w rozstrzygnięciach (88) w D80.
