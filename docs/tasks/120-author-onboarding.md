# 120 – Onboarding nowego autora

Model: sonnet

Subtask 108. Podstawa: [D85](../decisions/D085-poprawa-ux-ui-2.md), raport (B7). Branch `feature/120-author-onboarding` z `fix/ui-2`, merge do `fix/ui-2`. Zależy od 111.

## Zakres

- Lista „Pierwsze kroki” na stronie głównej zalogowanego (`app/[locale]/page.tsx`) i w pustym `/books`: utwórz książkę, napisz rozdział, uruchom korektę, opublikuj, uzupełnij „O mnie”. Stan każdego kroku liczony z danych (czy jest książka, rozdział z treścią, publikacja, bio) – zapytania z `userId` z sesji, `deletedAt: null`; korekta bez śladu w danych – pominąć ten krok.
- Lista znika po ukończeniu wszystkich kroków lub po „Ukryj” (zapis w `localStorage`, try/catch).
- Wariant tańszy zamiast tworzenia treści w bazie: pusty `/books` pokazuje `Empty` (111) z akcją „Nowa książka” – bez przykładowych rozdziałów w bazie.
- Teksty w `messages/*.json`.

## Kryteria akceptacji

1. Nowe konto widzi listę z pierwszym krokiem do zrobienia.
2. Wykonanie kroku (np. utworzenie książki) oznacza go jako zrobiony po odświeżeniu.
3. „Ukryj” chowa listę trwale w tej przeglądarce.
4. Konto z ukończonymi krokami nie widzi listy.

## Testy

- E2E: `onboarding.spec.ts` na świeżym koncie (1, 2, 3) i koncie seedowym (4). Logika stanu kroków (2) jako test integracyjny funkcji w `lib/`.
