# 96 – Szerokości treści i sidebar na stronach publicznych

Subtask 51. Podstawa: [D83](../decisions/D083-poprawa-ux-ui.md) i raport [`docs/ui-ux-report.md`](../ui-ux-report.md) (numery punktów w nawiasach). Branch `feature/96-layout-widths` z `fix/ui`, merge do `fix/ui`.

## Zakres

- Wspólny komponent kontenera (np. `components/page-container.tsx`) z wariantami `narrow` (`max-w-3xl`: listy, czytanie, formularze, feed, fora, wiadomości, moderacja, powiadomienia, biblioteka, strona główna, profil) i `wide` (`max-w-5xl`: lista książek, książka, statystyki, admin, wersje) (1.4). Użyty na wszystkich stronach `app/[locale]` poza edytorem; jednakowy padding i położenie nagłówka.
- Strony `/p/...` (profil, książka, rozdział, forum autora, obserwujący): zalogowany widzi ten sam layout z sidebarem co na pozostałych stronach (1.3); gość bez sidebara jak dotychczas. Tekst rozdziału zostaje w wąskiej kolumnie.

## Kryteria akceptacji

1. Każda strona używa jednego z dwóch wariantów; nagłówki stron tego samego wariantu zaczynają się w tym samym miejscu (1280 px).
2. Zalogowany na stronie książki i rozdziału publicznego ma sidebar; gość nie.

## Testy

- E2E: `tests/e2e/layout.spec.ts` – `boundingBox` nagłówka na kilku stronach każdego wariantu (1); sidebar na `/p/<nick>/<książka>` i rozdziale dla zalogowanego i gościa (2).
