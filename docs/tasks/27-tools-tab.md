# 27 – Zakładka Tools

Wynik researchu (2026-11-01). Wspólne miejsce na narzędzia z tasków 23 i 32–34. Zmienia D12 i D19.

## Zakres

- Trzeci panel boczny „Tools” obok Notes / Chapters, kolumna w Split i czwarta pozycja w przełączniku na wąskim ekranie.
- Stała siatka kafelków, bez dodawania i usuwania z listy.
- Kliknięcie kafelka pokazuje widok narzędzia w miejscu siatki, z przyciskiem powrotu.
- Rejestr narzędzi, do którego kolejne taski dopisują kafelek i widok.

## Ustalenia

- `SidePanel` dostaje `"tools"`, za tym idą `DEFAULT_LAYOUT`, `SIDE_PANELS`, `COLUMN_IDS`, `normalizeLayout`, `PANEL_LABELS`, `MOBILE_VIEWS` i siatka przełącznika.
- Tools jest zamontowane razem z innymi widokami i ukrywane przez `visibility: hidden` (D27), więc wynik narzędzia nie ginie przy zmianie zakładki.

## Dane z researchu

Stan z 2026-10-31. **[pomiar]** to wynik policzony na pobranym pliku, **[wniosek]** to interpretacja, **[do weryfikacji]** nie potwierdzono u źródła. Uwagi o licencjach to odczyt tekstów, nie porada prawna.

### Miejsca w kodzie

- `lib/editor-layout.ts`: `SidePanel`, `DEFAULT_LAYOUT`, `SIDE_PANELS`, `COLUMN_IDS`, `COLUMN_KEYS`, `normalizeLayout`. Ta ostatnia wymaga, żeby `order` zawierał dokładnie wszystkie panele, więc zapisany `order` o długości 2 wróciłby do domyślnego i po cichu skasował układ użytkownika. Trzeba go uzupełnić, nie odrzucać.
- `collapsed` wymienia klucze jawnie, a szerokości są per zestaw widocznych kolumn i nieznane zestawy są odrzucane (D19, D23). Trzecia kolumna boczna to nowe zestawy.
- `app/(protected)/stories/[id]/editor.tsx`: `PANEL_LABELS`, `MOBILE_VIEWS`, siatka trzech kolumn przełącznika, `KeptView` (`invisible`, nie `display: none`), tryb Split renderuje panele bez `KeptView`.
- `lib/settings/settings.ts`: `MOBILE_VIEWS` i walidacja `editor.mobileView`.
- Split i Hide/Show remontują grupę kolumn (D27), więc stan narzędzi trzymać nad drzewami układu, jak treść w D12.
- Testy do uzupełnienia: `tests/e2e/editor-panels.spec.ts`, `tests/e2e/editor-mobile.spec.ts`, `lib/settings/settings.test.ts`.

### Ustalenia z researchu

- Stała siatka zamiast dodawania narzędzi z listy.
- Odrzucone: zakładka „Dictionary” tylko ze słownikami, zakładka niebędąca kolumną w Split.
- Strona folderu nie ma panelu bocznego, więc Tools tam nie ma.

## Kryteria akceptacji

1. Tools działa na desktopie jako zakładka, w Split jako kolumna, a na wąskim ekranie jako czwarty widok.
2. Zapisany układ z dwoma panelami nie resetuje się po wdrożeniu: kolejność, szerokości i zwinięcia zostają, a Tools dochodzi.
3. Move left/right, Hide/Show i szerokości kolumn działają także dla Tools.
4. Przełączanie zakładek nie gubi otwartego narzędzia ani stanu edytora.
5. `editor.mobileView` przyjmuje i zapisuje widok Tools.
6. Siatka pokazuje kafelki, a przycisk powrotu wraca do siatki.

## Testy

Unit: `normalizeLayout` dla starych i nowych układów, ustawienia. E2E: zakładka, Split, wąski ekran, zachowanie stanu, otwarcie i powrót (uzupełnić `editor-panels.spec.ts`, `editor-mobile.spec.ts`).
