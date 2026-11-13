# 118 – Tryb skupienia w edytorze

Model: opus

Subtask 108. Podstawa: [D85](../decisions/D085-poprawa-ux-ui-2.md), raport (B6). Branch `feature/118-focus-mode` z `fix/ui-2`, merge do `fix/ui-2`. Zależy od 112.

## Zakres

- Przełącznik trybu skupienia w `components/markdown-editor.tsx` / `chapters/[id]/editor.tsx` (skrót klawiszowy i przycisk w pasku): (a) tryb maszyny do pisania – kursor utrzymywany w pionowym środku (wykorzystać `trackScrollGap`, `--scroll-gap-top`), (b) przyciemnienie reszty tekstu poza bieżącym zdaniem lub akapitem, (c) ukrycie paneli bocznych i stopki.
- Najpierw maszyna do pisania i ukrywanie paneli; przyciemnianie zdania/akapitu tylko jeśli da się je zrobić na nakładce edytora (`markdown-editor.tsx` ok. linii 733) bez psucia zaznaczania, wyszukiwania i autozapisu. Jeśli nie – pominąć i opisać w D85 jako rozstrzygnięcie.
- Wybrany tryb zapamiętany w `localStorage`, łatwo wyłączalny (iA zaleca wyłączać go przy redakcji).
- Tryb nie zmienia treści ani zapisu; licznik słów i status „Zapisano” pozostają dostępne.

## Kryteria akceptacji

1. Skrót klawiszowy i przycisk włączają i wyłączają tryb skupienia.
2. W trybie maszyny do pisania kursor pozostaje w środku widoku podczas pisania.
3. Panele boczne i stopka są ukryte w trybie skupienia i wracają po wyłączeniu.
4. Wybór przetrwa przeładowanie.
5. Autozapis, wyszukiwanie i zaznaczanie działają jak wcześniej.

## Testy

- E2E: `focus-mode.spec.ts` – przełączanie skrótem (1), pozycja kursora po wpisaniu wielu linii (2), widoczność paneli (3), reload (4); istniejące `editor`/`find-replace`/`autosave` bez regresji (5).
