# 13 – Myślniki dialogowe zamiast listy

Zgłoszenie użytkownika (2026-10-28): linia zaczynająca się od myślnika (dialog) zamienia się w listę punktowaną z kółkami. Ma wyglądać jak dialog w książce.

## Zakres

- Edytor WYSIWYG (Tiptap, D20): wpisanie `- ` na początku akapitu nie tworzy listy punktowanej.
- Podgląd i strony publiczne (`components/markdown-preview.tsx`) oraz eksport: linie dialogowe renderowane jako akapity z myślnikiem, bez punktora i wcięcia listy.
- Ustalenia z użytkownikiem: D28 w `decisions.md`.

## Kryteria akceptacji

1. Wpisanie `- Tekst` w edytorze daje akapit zaczynający się od myślnika, nie listę.
2. Kolejne linie dialogu wyglądają jak w książce: myślnik na początku akapitu, bez kółek i bez wcięcia listy – w edytorze, podglądzie, na stronie publicznej i w eksporcie.
3. Przełączenie Preview ↔ Source i zapis nie zmieniają dialogu w listę (round-trip markdown).
4. Bez migracji (D28): istniejące linie `- ` zostają listą, dopóki użytkownik nie poprawi ich ręcznie.

## Testy

- Jednostkowe: serializacja/parsowanie markdown z liniami dialogowymi – round-trip bez zmiany na listę (3).
- E2E: wpisanie dialogu w edytorze – brak `ul/li`, tekst z myślnikiem (1, 2); podgląd publiczny bez `li` (2); rozdział zapisany wcześniej z `- ` zostaje listą (4).
