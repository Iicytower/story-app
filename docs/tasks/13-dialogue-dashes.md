# 13 – Myślniki dialogowe zamiast listy

Zgłoszenie użytkownika (2026-10-28): linia zaczynająca się od myślnika (dialog) zamienia się w listę punktowaną z kółkami. Ma wyglądać jak dialog w książce.

## Zakres

- Edytor WYSIWYG (Tiptap, D20): wpisanie `- ` na początku akapitu nie tworzy listy punktowanej.
- Podgląd i strony publiczne (`components/markdown-preview.tsx`) oraz eksport: linie dialogowe renderowane jako akapity z myślnikiem, bez punktora i wcięcia listy.
- Do ustalenia przy starcie (pytanie do użytkownika):
  - jaki znak: zostawić `-` czy zamieniać na półpauzę `–` / pauzę `—` (w markdown źródłowym czy tylko przy renderowaniu);
  - czy listy punktowane mają zostać dostępne w inny sposób (np. `* `, przycisk w pasku narzędzi), czy znikają całkowicie;
  - co z istniejącymi treściami zapisanymi jako lista `- ` – migracja (D14) czy tylko inne renderowanie.
- Wpis w `decisions.md`.

## Kryteria akceptacji

1. Wpisanie `- Tekst` w edytorze daje akapit zaczynający się od myślnika, nie listę.
2. Kolejne linie dialogu wyglądają jak w książce: myślnik na początku akapitu, bez kółek i bez wcięcia listy – w edytorze, podglądzie, na stronie publicznej i w eksporcie.
3. Przełączenie Preview ↔ Source i zapis nie zmieniają dialogu w listę (round-trip markdown).
4. Istniejące rozdziały z dialogami wyświetlają się zgodnie z (2).

## Testy

- Jednostkowe: serializacja/parsowanie markdown z liniami dialogowymi – round-trip bez zmiany na listę (3).
- E2E: wpisanie dialogu w edytorze – brak `ul/li`, tekst z myślnikiem (1, 2); podgląd publiczny bez `li` (2); rozdział zapisany wcześniej z `- ` (4).
