# D41 – Zakładka Tools (2026-11-01)

Status: aktualna. Zmieniona w D51 (bez Split).

- Zmienia D12, D19 i D27. Trzeci panel boczny `tools`: zakładka, kolumna w Split, czwarty widok na wąskim ekranie (`editor.mobileView`). Zamontowany razem z innymi widokami (D27).
- Zakładka to tylko siatka kafelków z rejestru `TOOLS` (`app/(protected)/stories/[id]/tools.tsx`). Kafelek otwiera narzędzie w dialogu. Otwarte narzędzie trzyma `Editor`, a `ToolDialog` jest renderowany poza drzewami układu, więc zmiana szerokości okna go nie zamyka. Zmiana rozdziału i przeładowanie je zamykają. Name generator, Synonyms i Rhymes to atrapy („Coming soon.”) do tasków 42, 33 i 34.
- Bez Split wszystkie zakładki mają jedną szerokość: stałe id panelu `side-column` i klucz `story,side`. Zmiana zakładki nie zmienia już szerokości, co odwraca „szerokości per zakładka” z D27. `normalizeLayout` przenosi na ten klucz szerokość wybranej zakładki, a gdy jej nie ma, pierwszej zapisanej. Split ma nadal szerokości per zestaw kolumn.
- `normalizeLayout` uzupełnia `order` o brakujące panele zamiast go odrzucać. Zapisany układ ze Split bez `tools` dostaje `collapsed.tools = true`, bo trzecia widoczna kolumna zmieniłaby klucz szerokości i wyzerowała układ. Przycisk „Show tools” stoi przy prawej krawędzi.
- Przy trzech kolumnach bocznych domyślna szerokość to 20%, żeby Story nie spadło poniżej `minSize` 30%. `moveColumn` przeskakuje schowane kolumny, inaczej Move left/right bywałby bez widocznego efektu.
