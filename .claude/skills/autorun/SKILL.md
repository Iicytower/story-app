---
name: autorun
description: Run a sequence of tasks from docs/tasks/ unattended, with the main session orchestrating and subagents (implementer, verifier, reviewer, ui-checker, docs-keeper, merger, security-auditor, researcher) doing the work. Use when the user types /autorun <umbrella task or task numbers>, e.g. /autorun 68.
---

# Autorun

Argument: numer taska zbiorczego (np. `68`) albo lista numerów. Ty (główna sesja) tylko sterujesz: czytasz pliki tasków, zlecasz pracę agentom, commitujesz, mergujesz (sam, `merger` tylko przy konflikcie) i pilnujesz kolejności. Na task zwykle 1–2 starty agentów: każdy start to 20–40 tys. tokenów samego kontekstu. Własny kontekst oszczędzaj: nie czytaj kodu ani logów testów sam, jeśli może to zrobić agent.

## Zasady przebiegu (bez udziału użytkownika)

- Nie pytaj użytkownika. Decyzja spoza `docs/decisions.md` i pliku taska: wybierz najprostsze rozwiązanie spójne z decyzjami i implementer dopisuje je do sekcji „Rozstrzygnięcia Claude'a do potwierdzenia” decyzji taska zbiorczego (dla 68: plik obszaru w `docs/decisions/d80/`).
- Bez pushów, PR-ów, merge do `staging`/`main` (hooki `autorun-guard.sh` i `protect-branches.sh`). Pakiety npm tylko z listy w decyzji.
- Agentów wołaj na pierwszym planie (bez `run_in_background`), żeby hook Stop nie przerywał oczekiwania. Agenci piszący kod (`implementer`, `verifier`, `merger`, `docs-keeper`) pracują pojedynczo na jednym drzewie roboczym – nigdy dwóch naraz. Równolegle wolno puszczać tylko agentów bez zapisu (`researcher`, `reviewer`, `security-auditor`, `ui-checker`). Bez `isolation: worktree` (worktree powstaje z `main`).
- Czerwone testy po 3 rundach poprawek: zostaw zmiany na branchu taska, zacommituj je jako `NN: WIP (blocked)`, zleć `docs-keeper` sekcję „Blokada”, status zostaje `[~]`, wróć na branch zbiorczy bez merge i przejdź do następnego taska, który od zablokowanego nie zależy (bezpośrednio ani pośrednio).

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
   2. Co 4 taski (i przed pierwszym): `git log <branch zbiorczy>..develop`; gdy są nowe commity, merge `develop` → branch zbiorczy (sam, `merger` przy konflikcie).
   3. Utwórz `feature/NN-<slug>` z brancha zbiorczego, ustaw `[~]` w tabeli.
   4. Gdy task wymaga rozpoznania (sekcja Zakres mówi o researchu albo nowym API), najpierw `researcher` z konkretnymi pytaniami; wynik przekaż implementerowi w zleceniu.
   5. `implementer` (krótkie zlecenie): numer taska, branch, branch bazowy, pliki decyzji do przeczytania (dla 68: `scope.md`, `roles-bans-blocks.md` i plik obszaru taska z `docs/decisions/d80/`), wyniki researchu, „domknij task” (status `[x]`, `git mv` do `done/`, rozstrzygnięcia w pliku decyzji). Implementer uruchamia typecheck, lint, `npx vitest related <zmienione pliki> --run` i specy E2E dotkniętych stron.
   6. `reviewer` (baza: branch zbiorczy) tylko przy taskach ryzykownych: uprawnienia, bany i blokady, izolacja danych, widoczność publiczna, limity, usuwanie lub przenoszenie danych, wyścigi, bezpieczeństwo. Przy prostym UI, tekstach i dokumentacji – bez przeglądu.
   7. `ui-checker` tylko przy nowej stronie albo dużej zmianie UI: na działającym serwerze (bez buildu), dwa warianty (1280 jasny `/en`, 375 ciemny `/pl`). Może iść równolegle z `reviewer`.
   8. Uwagi blokujące z 6–7 → jedno zlecenie dla `implementer` ze wszystkimi uwagami naraz.
   9. Commit na branchu taska: `git add -A && git commit` z wiadomością `NN: <short english description>` i stopką atrybucji z system-reminder.
   10. Merge sam: `git switch <branch zbiorczy> && git merge --no-ff feature/NN-<slug>`. Konflikt → `git merge --abort` i `merger`.
   11. Co 3–4 taski i przed końcowym audytem (punkt 3): `verifier` z pełnym `npm run verify` na branchu zbiorczym. Czerwono → `implementer` z diagnozą → `verifier` (do 3 rund; potem blokada taska, który zepsuł).
       `docs-keeper` tylko przy sekcjach „Blokada”/„Pominięty” albo większych zmianach `README.md`, `docs/deploy.md` (z częściami w `docs/deploy/`) i skilla `local-setup`.
3. Na końcu (po wszystkich subtaskach): `security-auditor` dla `git diff develop...<branch zbiorczy>`; znaleziska krytyczne i wysokie → implementer/verifier jak w taskach (osobny commit `NN: security fixes`). Potem zamknij task zbiorczy (sam albo `docs-keeper`, commit), ale nie merguj go do `develop` – robi to użytkownik.
4. Raport końcowy dla użytkownika: tabela task → status (zrobiony / zablokowany z powodem / pominięty), lista rozstrzygnięć do potwierdzenia, co musi zrobić użytkownik przed wydaniem.

## Po kompakcji kontekstu

Stan odtwarzasz z repo, nie z pamięci: `git branch --show-current`, `git log --oneline -15 <branch zbiorczy>`, statusy w tabeli `docs/tasks/README.md` i sekcje „Blokada” w plikach tasków.
