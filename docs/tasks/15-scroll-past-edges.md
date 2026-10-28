# 15 – Przewijanie poza początek i koniec tekstu

Zgłoszenie użytkownika (2026-10-28): obszar tekstu ma się dać przewinąć w dół i w górę także poza tekst, z ogranicznikiem: pierwsza i ostatnia linia są zawsze widoczne.

## Zakres

- Edytor treści rozdziału w Preview i Source (`components/markdown-editor.tsx`): dodatkowa przestrzeń nad pierwszą i pod ostatnią linią, tak żeby ostatnią linię dało się przewinąć do góry viewportu, a pierwszą do dołu – ale nie dalej (odstęp = wysokość widoku minus jedna linia).
- Do ustalenia przy starcie: czy dotyczy też notatek (rozdziału i folderu); czy przy otwarciu rozdziału tekst startuje od góry obszaru (bez pustego miejsca nad pierwszą linią).
- Odstęp przelicza się przy zmianie rozmiaru paneli i okna.

## Kryteria akceptacji

1. Przy przewinięciu maksymalnie w dół ostatnia linia jest widoczna przy górnej krawędzi obszaru.
2. Przy przewinięciu maksymalnie w górę pierwsza linia jest widoczna przy dolnej krawędzi obszaru (albo – zależnie od ustalenia – tekst startuje od góry).
3. Krótki tekst (mniej niż ekran) też da się przewinąć w ten sposób.
4. Zmiana rozmiaru panelu lub okna zachowuje ograniczenie.
5. Działa w Preview i Source.

## Testy

- E2E: `scrollTop` maksymalny → bounding box ostatniej linii w obrębie obszaru i blisko jego góry (1); minimalny → pierwsza linia widoczna (2); krótki tekst (3); zmiana rozmiaru viewportu i ponowne sprawdzenie (4); oba tryby (5).
