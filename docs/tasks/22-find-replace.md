# 22 – Wyszukiwanie i zamiana w polu

Zgłoszenie użytkownika (2026-10-30). Odpowiednik Ctrl+H z VS Code.

## Zakres

- Wyszukiwanie w jednym polu edytora, z zaznaczeniem wszystkich trafień, licznikiem i przechodzeniem do następnego i poprzedniego.
- Zamiana bieżącego trafienia i wszystkich trafień w tym polu na podany ciąg znaków.
- Działa w każdym `MarkdownEditor`: treść rozdziału, notatki rozdziału, notatki folderu.

## Ustalenia

Decyzje przy starcie taska: D35.

## Kryteria akceptacji

1. Ctrl+F przy fokusie w polu otwiera panel, Ctrl+H także zamianę; poza polem zostają skróty przeglądarki.
2. Trafienia są zaznaczone, jest licznik, przechodzenie do następnego i poprzedniego.
3. Opcje: wielkość liter, całe słowa (także z polskimi znakami), regex; błędny regex daje komunikat.
4. „Replace” zamienia bieżące trafienie, „Replace all” wszystkie w tym polu.
5. Działa w Preview i Source; komentarze są przeszukiwane jak zwykły tekst.
6. Działa w treści rozdziału, notatkach rozdziału i notatkach folderu.
7. „Replace all” cofa jedno Undo.
8. Zamiana zapisuje się autozapisem.

## Testy

Unit: wyszukiwanie i zamiana. E2E: przepływ wyszukiwania i zamiany w treści i w notatkach, Undo po „Replace all”, autosave po zamianie.
