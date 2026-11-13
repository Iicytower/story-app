# 112 – Edytor na mobile

Model: sonnet

Subtask 108. Podstawa: [D85](../decisions/D085-poprawa-ux-ui-2.md), raport (A1, A2, A15), D81 (guidelines). Branch `feature/112-editor-mobile` z `fix/ui-2`, merge do `fix/ui-2`. Zależy od 110.

## Zakres

- `chapters/[id]/editor.tsx`: na ekranach poniżej `md` edytor zawsze startuje na zakładce „Tekst” (nie pamiętać zakładki „Narzędzia” z desktopu).
- Nagłówek, zakładki i toolbar zajmują mniej niż ok. 200 px z 812: toolbar w jednym rzędzie z poziomym przewijaniem wewnątrz paska.
- Cele dotykowe poniżej `md`: przyciski toolbaru, przełącznik Tekst/Markdown, „Kopiuj link”, „Otwórz” – min. 36–44 px (na desktopie bez zmian).
- Panel „Narzędzia” na desktopie: ostatnio użyte narzędzie na wierzchu (zapis w `localStorage`), reszta bez zmian.

## Kryteria akceptacji

1. Na 375 px nowo otwarty rozdział pokazuje zakładkę „Tekst”.
2. Wszystkie wymienione przyciski mają co najmniej 36 px wysokości i szerokości na 375 px.
3. Toolbar nie powoduje poziomego przewijania strony; zajmuje jeden rząd.
4. Ostatnio użyte narzędzie jest widoczne na wierzchu panelu „Narzędzia”.

## Testy

- E2E (viewport 375): `editor-mobile.spec.ts` – zakładka startowa (1), `boundingBox` przycisków (2), brak scrolla poziomego (3); desktop: ostatnio użyte narzędzie (4).
