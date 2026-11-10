---
name: autorun
description: Run a sequence of tasks from docs/tasks/ unattended, with the main session orchestrating and subagents (implementer, verifier, reviewer, ui-checker, docs-keeper, merger, security-auditor, researcher) doing the work. Use when the user types /autorun <umbrella task or task numbers>, e.g. /autorun 68.
---

# Autorun

Argument: numer taska zbiorczego (np. `68`) albo lista numerów. Ty (główna sesja) tylko sterujesz: czytasz pliki tasków, zlecasz pracę agentom, commitujesz, mergujesz przez `merger` i pilnujesz kolejności. Własny kontekst oszczędzaj: nie czytaj kodu ani logów testów sam, jeśli może to zrobić agent.

## Zasady przebiegu (bez udziału użytkownika)

- Nie pytaj użytkownika. Decyzja spoza `docs/decisions.md` i pliku taska: wybierz najprostsze rozwiązanie spójne z decyzjami i zleć `docs-keeper` dopisanie go do sekcji „Rozstrzygnięcia Claude'a do potwierdzenia” decyzji taska zbiorczego (dla 68: D80).
- Bez pushów, PR-ów, merge do `staging`/`main` (deny i hook). Pakiety npm tylko z listy w decyzji.
- Agentów wołaj na pierwszym planie (bez `run_in_background`), żeby hook Stop nie przerywał oczekiwania. Agenci piszący kod (`implementer`, `verifier`, `merger`, `docs-keeper`) pracują pojedynczo na jednym drzewie roboczym – nigdy dwóch naraz. Równolegle wolno puszczać tylko agentów bez zapisu (`researcher`, `reviewer`, `security-auditor`, `ui-checker`). Bez `isolation: worktree` (worktree powstaje z `main`).
- Czerwone testy po 3 rundach implementer ↔ verifier: zostaw zmiany na branchu taska, zacommituj je jako `NN: WIP (blocked)`, zleć `docs-keeper` sekcję „Blokada”, status zostaje `[~]`, wróć na branch zbiorczy bez merge i przejdź do następnego taska, który od zablokowanego nie zależy (bezpośrednio ani pośrednio).

## Tryb bez nadzoru (hooki)

- Start: `echo <numer taska zbiorczego> > .claude/autorun.lock`. Dopóki plik istnieje, hooki odrzucają `AskUserQuestion` i instalację pakietów (`autorun-guard.sh`), po kompakcji przywracają stan z repo (`autorun-state.sh`), a zatrzymanie jest blokowane, dopóki zostały subtaski bez `[x]`, „Blokada” lub „Pominięty” (`autorun-continue.sh`; drugi stop bez nowego commita przechodzi).
- Koniec (po raporcie końcowym): `rm -f .claude/autorun.lock .claude/autorun.last-stop`.

## Skille dla agentów

- `implementer` i `verifier` mają wczytany `test-patterns`.
- W zleceniach dla `implementer`, `reviewer` i `security-auditor` przy taskach 69–91 dopisz: „Użyj skilla `social-checklist`”.

## Pętla

1. Ustal kolejkę: wiersze tabeli `docs/tasks/README.md` dla podanych tasków, w kolejności tabeli, ze statusem `[ ]` albo `[~]` bez sekcji „Blokada”. Branch bazowy: branch zbiorczy z decyzji (dla 68: `feature/social`, utwórz z `develop`, jeśli go nie ma).
2. Dla każdego taska:
   1. Zależy od zablokowanego (bezpośrednio lub pośrednio) → `docs-keeper` dopisuje „Pominięty”, idź dalej.
   2. Co 4 taski (i przed pierwszym) zleć `merger`: `develop` → branch zbiorczy.
   3. Utwórz `feature/NN-<slug>` z brancha zbiorczego, ustaw `[~]` w tabeli.
   4. Gdy task wymaga rozpoznania (sekcja Zakres mówi o researchu albo nowym API), najpierw `researcher` z konkretnymi pytaniami; wynik przekaż implementerowi w zleceniu.
   5. `implementer`: numer taska, branch, branch bazowy, wyniki researchu.
   6. `verifier`: pełne `npm run verify`. Czerwono → `implementer` z diagnozą → `verifier` (do 3 rund).
   7. Równolegle `reviewer` (baza: branch zbiorczy) i, gdy task zmienia UI, `ui-checker` dla stron z taska. Uwagi blokujące → `implementer` → `verifier`.
   8. `docs-keeper`: zamknięcie taska + rozstrzygnięcia z raportów.
   9. Commit na branchu taska: `git add -A && git commit` z wiadomością `NN: <short english description>` i stopką atrybucji z system-reminder.
   10. `merger`: branch taska → branch zbiorczy.
3. Na końcu (po wszystkich subtaskach): `security-auditor` dla `git diff develop...<branch zbiorczy>`; znaleziska krytyczne i wysokie → implementer/verifier jak w taskach (osobny commit `NN: security fixes`). Potem zamknij task zbiorczy (`docs-keeper`, commit), ale nie merguj go do `develop` – robi to użytkownik.
4. Raport końcowy dla użytkownika: tabela task → status (zrobiony / zablokowany z powodem / pominięty), lista rozstrzygnięć do potwierdzenia, co musi zrobić użytkownik przed wydaniem.

## Po kompakcji kontekstu

Stan odtwarzasz z repo, nie z pamięci: `git branch --show-current`, `git log --oneline -15 <branch zbiorczy>`, statusy w tabeli `docs/tasks/README.md` i sekcje „Blokada” w plikach tasków.
