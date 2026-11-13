# 116 – Strona główna, sidebar, szerokości

Model: sonnet

Subtask 108. Podstawa: [D85](../decisions/D085-poprawa-ux-ui-2.md), raport (A6, A8, A10, A11). Branch `feature/116-home-sidebar-widths` z `fix/ui-2`, merge do `fix/ui-2`. Zależy od 111.

## Zakres

- Strona główna na mobile: chipy kategorii i tagów min. 32 px, strzałki karuzeli ukryte dla `pointer: coarse`, mniejszy placeholder okładki (tytuł nad zgięciem).
- Moderacja: domyślna zakładka to ta z licznikiem > 0 (zgłoszenia), w przeciwnym razie dotychczasowa.
- Wiadomości: awatary w liście rozmów, wskaźnik nieprzeczytanych (kropka/pogrubienie) i badge „Wiadomości” w sidebarze (jak „Powiadomienia”).
- Sidebar: badge przy „Admin” z liczbą oczekujących zgłoszeń (bez drugiego zapytania na stronę – skorzystać z już liczonego licznika `AppShell`).
- Dwie standardowe szerokości kontenera (węższa dla list i czytania, szersza dla tabel/dashboardów) zamiast mieszanki ~720/~976 px; strony przypisane według sensu.

## Kryteria akceptacji

1. Na 375 px chipy mają co najmniej 32 px, brak strzałek karuzeli przy dotyku.
2. `/moderation` z oczekującymi zgłoszeniami otwiera się na zgłoszeniach.
3. Nieprzeczytana rozmowa jest oznaczona, a „Wiadomości” w sidebarze ma badge.
4. „Admin” ma badge zgłoszeń tylko dla admina.
5. Strony używają jednej z dwóch szerokości.

## Testy

- E2E: `home.spec.ts` (1), `moderation.spec.ts` (2), `messages.spec.ts` (3), `sidebar.spec.ts` (4), pomiar szerokości `main` na kilku stronach (5). Badge „Admin” tylko dla admina (4) także w teście integracyjnym uprawnień. Użyć `social-checklist` (uprawnienia).
