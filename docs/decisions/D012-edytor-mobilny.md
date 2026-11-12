# D12 – Widok mobilny edytora (2026-10-06, zmienione 2026-10-20 w D19, 2026-11-01 w D41)

Status: aktualna. Zmieniona w D19, D41.

- Odstępstwo od „tylko desktop” w spec: edytor obsługuje wąskie ekrany. Poniżej breakpointu `md` (768 px) na górze jest przełącznik Story / Notes / Chapters / Tools (D41; `role="tablist"`, nazwa „View”) i widoczny jest jeden panel naraz. Zakładka Story pokazuje edytor WYSIWYG (D20); Notes – notatki folderu nad notatkami rozdziału, bez separatora.
- Na wąskim ekranie przyciski paska narzędzi pokazują tylko ikony (etykieta w `sr-only`), przyciski zwijania i Split są ukryte, a pola tekstowe mają `text-base`, żeby iOS nie powiększał strony przy fokusie.
- Układ (desktop lub mobile) wybiera `matchMedia` (`useSyncExternalStore`, serwer renderuje desktop), więc w DOM jest tylko jedno drzewo paneli i każde pole występuje raz. Widoki Story / Notes / Chapters są zamontowane jednocześnie, a nieaktywne ukryte (D27). Treść, notatki i notatki folderu trzyma komponent nad oboma drzewami, więc zmiana szerokości okna ich nie gubi.
