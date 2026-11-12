# D45 – Claude nie merguje do `staging` i `main` (2026-11-02)

Status: aktualna. Zmienia D15.

- Zmienia D15. Decyzja użytkownika po merge'u `develop` → `staging`, o który nie poprosił wprost: merge do `staging` i `main` oraz push na te branche robi wyłącznie użytkownik, także gdy prosi o testy na stagingu. Claude pushuje tylko `develop` (na prośbę) i otwiera PR-y wydań.
- Egzekwuje to hook PreToolUse `.claude/hooks/protect-branches.sh`: blokuje `git merge` na tych branchach, `git push` na nie i wszystkie `gh pr merge` (każdy PR w tym repo celuje w `staging` albo `main`).
- `resolve-pr-conflicts` pomija PR-y z headem `staging` lub `main` i podaje komendy użytkownikowi.
