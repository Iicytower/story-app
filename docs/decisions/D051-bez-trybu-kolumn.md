# D51 – Bez trybu kolumn w edytorze (2026-11-03)

Status: aktualna. Zastępuje część D41.

- Tryb „Split” (prawy panel jako osobne kolumny) znika razem z kodem; edytor ma tylko panel boczny z zakładkami (decyzja użytkownika, task 47).
- Zapisane `split`, `order` i szerokości kolumn są ignorowane przy odczycie, bez migracji.
- `widths` to teraz jedna para rozmiarów `story-column` / `side-column`. Przy odczycie starego zapisu (rekord per zestaw kolumn) `normalizeLayout` bierze szerokość zakładek spod klucza `story,side`, więc użytkownik nie traci ustawionej szerokości. Zmienia D27 i odpowiednie punkty o Split w D12, D19 i przy panelu Tools.
