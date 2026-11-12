# D80 – Przebieg i branche

Część decyzji D80 (System społecznościowy, 2026-11-10); indeks w [`../../decisions.md`](../../decisions.md).

- Branch zbiorczy `feature/social` z `develop`; branche tasków `feature/NN-<slug>` z niego i do niego. Nie jest pushowany; do `develop` merguje go użytkownik po przeglądzie (jak `security`, D70). Okresowo `develop` → `feature/social` (agent `merger`).
- Przebieg bez nadzoru (skill `/autorun`): decyzja spoza D80 → Claude wybiera najprostsze rozwiązanie spójne z D80 i dopisuje je do sekcji „Rozstrzygnięcia Claude'a do potwierdzenia” w pliku obszaru w `docs/decisions/d80/` (bez przypisanego obszaru: `scope.md`) (jak D78). Czerwone testy po kilku próbach naprawy → task zostaje `[~]` z notatką „Blokada” w pliku taska, przebieg idzie dalej taskami od niego niezależnymi. Bez powiadomień push. Brak pushów i PR-ów (hook `autorun-guard.sh`; serwer zdalny zablokowany przez deny w `.claude/settings.json`).
