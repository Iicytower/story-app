# D30 – Przewijanie poza tekst (2026-10-30)

Status: aktualna. Zmieniona w D83 (górny odstęp dwie linie).

- Dotyczy każdego `MarkdownEditor`: treści, notatek rozdziału i notatek folderu. Odstęp nad pierwszą linią to połowa, a pod ostatnią trzy czwarte wysokości widoku minus jedna linia (`--scroll-gap-top`, `--scroll-gap-bottom`, liczone w `trackScrollGap`, `ResizeObserver` na elemencie przewijanym; zmniejszone 2026-11-03 na prośbę użytkownika z pełnej wysokości). Wysokość linii pochodzi z pola, więc dłuższy nagłówek jako ostatnia linia jest przy maksymalnym przewinięciu widoczny częściowo.
- Po otwarciu `scrollTop` to 0, czyli pierwsza linia stoi w połowie widoku. To decyzja użytkownika, tak samo nad tekstem w notatkach i przy zapamiętanej pozycji „na początku” (D27).
- Element nie może być niższy niż jego padding, więc textarea w Source nie przewija się sama: rośnie z tekstem (`field-sizing: content`), a przewija ją zewnętrzny element, jak w Preview. Kliknięcie w pusty obszar ustawia fokus w polu. `field-sizing` nie ma fallbacku, Source wymaga przeglądarki, która go obsługuje (testy: Chromium).
- Pozycja nad pierwszą linią nie jest kotwicą: przełączenie Preview/Source z tego obszaru (`scrollTop` > 0) ustawia pierwszą linię przy górnej krawędzi.
