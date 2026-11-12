# D15 – Branch `develop` (2026-10-20)

Status: aktualna. Częściowo zmieniona w D45.

Zmienia przepływ z D13: `feature/NN-<slug>` (z `develop`) → `develop` → `staging` → `main`.

- Zakończony task jest mergowany do `develop`. Push `develop` oraz merge `develop` → `staging` (i push `staging`) Claude robi tylko na prośbę użytkownika. Merge `staging` → `main` dalej robi wyłącznie użytkownik.
- Preview Vercela dla `develop` nie ma zmiennych środowiskowych, więc nie łączy się z bazą, a migracje są pomijane (D14).
