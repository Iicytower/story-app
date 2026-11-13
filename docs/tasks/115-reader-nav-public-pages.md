# 115 – Nawigacja w czytniku i strony publiczne

Model: sonnet

Subtask 108. Podstawa: [D85](../decisions/D085-poprawa-ux-ui-2.md), raport (B10, B13, A4, A5). Branch `feature/115-reader-nav-public-pages` z `fix/ui-2`, merge do `fix/ui-2`. Zależy od 113.

## Zakres

- Selektor rozdziałów w czytniku (`Popover` + lista, bieżący z `aria-current="page"`, nieprzeczytane oznaczone) i cienki pasek postępu przewijania; dane z istniejącego `reading-tracker.tsx`.
- Breadcrumb: `components/ui/breadcrumb.tsx` (shadcn) zamiast `p/[nickname]/breadcrumb.tsx` (z `aria-current="page"` na ostatnim elemencie); dodany w `books/[id]` i `versions/[number]` zamiast ręcznych strzałek wstecz (`follow-list.tsx`, `editor.tsx`, `proofreading.tsx` – tylko tam, gdzie breadcrumb zastępuje strzałkę).
- Publiczna książka: bez podwójnej numeracji („1. Rozdział 1. …” – pominąć numer listy, gdy tytuł go zawiera), linki rozdziałów wyróżnione, link „Edytuj książkę” dla autora.
- Profil publiczny: „Książki” i „Biblioteka” jako karty/wiersze z liczbą rozdziałów, statusem i okładką (jak w `/books`).

## Kryteria akceptacji

1. Z rozdziału można przejść do dowolnego innego jednym wyborem z listy; aktualny jest oznaczony.
2. Pasek postępu odzwierciedla przewinięcie.
3. Breadcrumb ma `aria-current="page"` na bieżącym elemencie i nie zastępuje nic poza strzałkami wstecz.
4. Autor widzi „Edytuj książkę” na własnej publicznej stronie; inni nie.
5. Lista rozdziałów nie ma podwójnej numeracji.
6. Profil pokazuje książki z metadanymi.

## Testy

- E2E: `reader-nav.spec.ts` (1, 2), `public-book.spec.ts` (4, 5), `profile.spec.ts` (6), asercja `aria-current` (3). Widoczność „Edytuj książkę” zależnie od sesji (4) także jako test integracyjny, jeśli logika jest po stronie serwera.
