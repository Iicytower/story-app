# D78 – Decyzje Claude'a z nocy 2026-11-09/10 do potwierdzenia

Status: archiwalna – lista niepotwierdzonych rozstrzygnięć Claude'a do D70–D77.

D70–D77 łączą decyzje użytkownika (z pytań przed startem) z rozstrzygnięciami Claude'a, których użytkownik jeszcze nie potwierdził:

- D74: zmienna `TRUSTED_IP_HEADER` (użytkownik wybrał tylko Vercela; zmienna służy testom E2E i ewentualnej przeprowadzce). Limit rejestracji liczy też zajęte nicki (skutek I1), 5 na godzinę z adresu; nowy tekst `tooManyAccounts`.
- D72: przy limicie wersji blokowane jest też przywracanie wersji. Edytor treści nie blokuje wpisywania ponad 500 000 znaków (Tiptap nie ma `maxLength`), tylko pokazuje komunikat i nie zapisuje.
- D75: cache sesji 10 s w pamięci procesu (opóźnienie unieważnienia na innych instancjach i w proxy), `sid` widoczny w `/api/auth/session`, próg ciągu w regułach haseł (6 znaków) i próg powtórzeń (połowa hasła). Zmienione hasła kont testowych E2E.
- D76: ekran kodów nie daje się zamknąć bez zaznaczenia „Mam zapisane te kody”; nowy tekst `noRecovery` przy rejestracji.
- D77: `'wasm-unsafe-eval'` dla pdf.js; `style-src 'unsafe-inline'`.
- D70: TypeScript 6.0.3 zamiast 7 (blokuje `typescript-eslint`).
