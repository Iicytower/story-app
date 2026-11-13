# 100 – Strona główna: skrót do pisania i mniej sekcji

Subtask 51. Podstawa: [D83](../../decisions/D083-poprawa-ux-ui.md) i raport [`docs/ui-ux-report.md`](../../ui-ux-report.md) (numery punktów w nawiasach). Branch `feature/100-home-page` z `fix/ui`, merge do `fix/ui`.

## Zakres

- Zalogowany: na górze wiersz „Ostatnio edytowane: <tytuł rozdziału> (<książka>) → Kontynuuj” (link do `/chapters/[id]` ostatnio zmienionego rozdziału użytkownika, `deletedAt: null`) i przycisk „Nowa książka”; bez rozdziałów: sam przycisk (2.1).
- Usunięte sekcje „Popularne w kategoriach” (kategorie jako filtr chipów nad listą, działający jak dotychczasowy klik w chip) i „Od obserwowanych” (2.2; D54 i D80 `stats-discovery.md` zmienione w D83). Zapytania, komponenty i klucze `messages` bez użycia usunięte.
- Wyszukiwarka: przycisk z ikoną lupy (`aria-label`), placeholder „Szukaj opowiadań” / „Search stories”, etykiety „Kategorie” / „Tagi” przy wierszach chipów (2.3).
- Mobile: data w linii z autorem na liście (2.4).

## Kryteria akceptacji

1. Zalogowany z rozdziałami widzi „Kontynuuj” do ostatnio edytowanego własnego rozdziału; gość nie widzi wiersza.
2. Na stronie nie ma sekcji „Popularne w kategoriach” i „Od obserwowanych”; chip kategorii filtruje listę.
3. Wyszukiwanie działa przyciskiem i Enterem; placeholder mieści się na 375 px.

## Testy

- Integracyjne: zapytanie o ostatnio edytowany rozdział (izolacja per użytkownik, pomija usunięte) (1).
- E2E: `home.spec.ts` (1, 2), `search.spec.ts` (3).
