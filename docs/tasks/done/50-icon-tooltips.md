# 50 – Podpowiedzi przy przyciskach z samą ikoną

Zgłoszenie użytkownika (2026-11-03). Przyciski bez widocznego opisu (np. tagi, publikacja, przeniesienie, usunięcie w wierszu rozdziału) pokazują po najechaniu kursorem podpowiedź, co robią (D53).

## Zakres

- Komponent `components/ui/tooltip.tsx` (shadcn Tooltip na Radix z pakietu `radix-ui`, bez nowej zależności) i jeden `TooltipProvider` w layoucie.
- Podpowiedź przy każdym przycisku, który pokazuje tylko ikonę, z tym samym tekstem co jego `aria-label`:
  - wiersze rozdziałów i folderów: tagi, publikacja, przeniesienie, usunięcie, przesuwanie w górę i w dół (`tags-dialog`, `publish-chapter-button`, `move-story-dialog`, `delete-story-button`, `reorder-buttons`), usunięcie wersji (`folder-versions`);
  - pasek edytora markdown i panel wyszukiwania (`markdown-editor`, `find-panel`);
  - edytor opowiadania: pokazywanie i ukrywanie panelu bocznego, przyciski, które na wąskim ekranie chowają etykietę (eksport, import, publikacja, kopiowanie linku);
  - zwinięty sidebar i przycisk menu (`app-sidebar`), zamykanie dialogu (`ui/dialog`).
- Natywne `title` na tych przyciskach zastępuje tooltip, żeby nie było dwóch podpowiedzi naraz.
- Teksty bez zmian: tooltip bierze istniejące klucze ze słowników `en` i `pl`.

## Ustalenia

- Stylizowany tooltip, nie natywny `title` (decyzja użytkownika): w kolorach aplikacji, krótkie opóźnienie, pokazuje się też przy fokusie z klawiatury.
- Przyciski z widoczną etykietą nie dostają tooltipa.
- Przyciski, które chowają etykietę tylko na wąskim ekranie (eksport, import, publikacja, kopiowanie linku), mają tooltip ukryty od `md`, gdzie etykieta jest widoczna. Sidebar ma tooltipy tylko po zwinięciu.
- Tooltip przy fokusie pokazuje się tylko przy `:focus-visible`, więc fokus wracający do przycisku po zamknięciu dialogu myszą go nie otwiera.
- Treść tooltipa nie łapie kursora (`pointer-events-none`, `disableHoverableContent`), więc nie zasłania sąsiednich przycisków.

## Kryteria akceptacji

1. Każdy przycisk z samą ikoną pokazuje podpowiedź po najechaniu kursorem i przy fokusie z klawiatury.
2. Tekst podpowiedzi jest taki sam jak `aria-label` przycisku i jest w języku interfejsu.
3. Przyciski z samą ikoną nie mają już natywnego `title`.
4. Podpowiedź jest czytelna w trybie jasnym i ciemnym.

## Testy

E2E: najechanie i fokus na przykładowych przyciskach (tagi i publikacja w wierszu rozdziału, pogrubienie w edytorze, zwinięty sidebar) pokazuje `role="tooltip"` z tekstem jak `aria-label`, także na `/pl`; poprawione testy, które dziś szukają tych przycisków po `title`. `manual`: przegląd, że żaden przycisk z samą ikoną nie został bez podpowiedzi (grep po `size="icon"` i `sr-only`), wygląd w obu trybach.
