# 106 – Moderacja i panel admina

Subtask 51. Podstawa: [D83](../decisions/D083-poprawa-ux-ui.md) i raport [`docs/ui-ux-report.md`](../ui-ux-report.md) (numery punktów w nawiasach). Branch `feature/106-moderation-admin` z `fix/ui`, merge do `fix/ui`. Użyj skilla `social-checklist`.

## Zakres

- Moderacja autora: licznik oczekujących zgłoszeń przy zakładce „Zgłoszenia” i przy „Moderacja” w sidebarze (miejsce z 95) (7.2). Licznik tylko z obiektów, które użytkownik moderuje.
- Panel admina: „Zbanuj globalnie” jako przycisk w stylu destrukcyjnym (obrys `destructive`) z potwierdzeniem jak dotychczas; etykiety zgłoszeń „Zgłoszony profil: <nick>” / „Reported profile: <nick>” (i analogicznie dla innych typów) (7.3).

## Kryteria akceptacji

1. Licznik zgłoszeń przy zakładce i w sidebarze zgadza się z liczbą oczekujących zgłoszeń użytkownika; znika po rozpatrzeniu.
2. Ban globalny wygląda jak przycisk destrukcyjny; etykieta wskazuje zgłoszony obiekt, nie zgłaszającego.

## Testy

- Integracyjne: `reports.test.ts` – liczba oczekujących per moderator (1, cudze zgłoszenia nie liczą się).
- E2E: `moderation.spec.ts` (1), `admin.spec.ts` (2).
