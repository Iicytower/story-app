# 40 – Wyświetlanie okładek

Wydzielone z dawnego taska 26 (zgłoszenie z 2026-10-30).

## Zakres

- Wyświetlanie okładek w widokach ustalonych przy starcie taska.
- Rozdział bez własnej okładki pokazuje okładkę folderu.

Do decyzji przy starcie taska (wynik jako nowa decyzja w `decisions.md`): widoki z okładką: lista folderów, strona folderu, panel Chapters, edytor, strony publiczne.

## Kryteria akceptacji

1. Rozdział bez okładki pokazuje okładkę folderu, a rozdział z okładką własną.
2. Usunięcie okładki rozdziału wraca do okładki folderu; rozdział i folder bez okładek nie pokazują uszkodzonego obrazka.
3. Przeniesienie rozdziału bez własnej okładki pokazuje okładkę nowego folderu.
4. Strony publiczne pokazują okładkę tylko, jeśli decyzja przy starcie tak stanowi.

## Testy

Unit: wybór okładki z fallbackiem do folderu. E2E: fallback rozdziału do folderu, przeniesienie, brak okładek. `manual`: wyświetlanie przez adres R2.
