# D53 – Tooltipy przy przyciskach z samą ikoną (2026-11-03)

Status: aktualna. Częściowo zmieniona w D55.

- Przyciski bez widocznej etykiety mają stylizowany tooltip (shadcn Tooltip na Radix) z tekstem jak `aria-label`, zamiast natywnego `title` (decyzja użytkownika, task 50).
- `WithTooltip` w `components/ui/tooltip.tsx`, jeden `TooltipProvider` w `app/[locale]/layout.tsx` (opóźnienie 300 ms). Fokus otwiera tooltip tylko przy `:focus-visible`; treść nie przyjmuje kursora. Przyciski chowające etykietę na wąskim ekranie mają tooltip tylko poniżej `md`, zwinięty sidebar po prawej stronie ikon.
