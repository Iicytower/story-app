---
name: autorun
description: Run a sequence of tasks from docs/tasks/ unattended, with the main session orchestrating and subagents (implementer, verifier, reviewer, ui-checker, docs-keeper, merger, security-auditor, researcher) doing the work. Use when the user types /autorun <umbrella task or task numbers>, e.g. /autorun 68.
---

# Autorun

Argument: the number of an umbrella task (e.g. `68`) or a list of numbers. You (the main session) only steer: read task files, delegate work to agents, commit, merge (yourself, `merger` only on a conflict) and keep the order. Usually 1–2 agent starts per task: each start costs 20–40k tokens of context alone. Save your own context: do not read code or test logs yourself if an agent can do it.

## Run rules (without the user)

- Do not ask the user. A decision outside `docs/decisions/` and the task file: pick the simplest solution consistent with the decisions; the implementer adds it to the "Rozstrzygnięcia Claude'a do potwierdzenia" section of the umbrella task's decision (for 68: the area file in `docs/decisions/D080-system-spolecznosciowy/`; for 51: the section at the end of `docs/decisions/D083-poprawa-ux-ui.md`).
- No pushes, PRs or merges into `staging`/`main` (hooks `autorun-guard.sh` and `protect-branches.sh`). npm packages only from the list in the decision.
- Call agents in the foreground (no `run_in_background`), so the Stop hook does not interrupt the wait. Agents that write code (`implementer`, `verifier`, `merger`, `docs-keeper`) work one at a time on a single working tree – never two at once. Only read-only agents (`researcher`, `reviewer`, `security-auditor`, `ui-checker`) may run in parallel. No `isolation: worktree` (the worktree is created from `main`).
- Red tests after 3 rounds of fixes: leave the changes on the task branch, commit them as `NN: WIP (blocked)`, have `docs-keeper` add a "Blokada" section, status stays `[~]`, go back to the umbrella branch without merging and continue with the next task that does not depend on the blocked one (directly or indirectly).

## Unattended mode (hooks)

- Start: `echo <umbrella task number> > .claude/autorun.lock`. While the file exists, hooks reject `AskUserQuestion` and package installs (`autorun-guard.sh`), restore state from the repo after compaction (`autorun-state.sh`), and block stopping while subtasks without `[x]`, "Blokada" or "Pominięty" remain (`autorun-continue.sh`; a second stop without a new commit goes through).
- End (after the final report): `rm -f .claude/autorun.lock .claude/autorun.last-stop`.

## Skills for agents

- `implementer` and `verifier` have `test-patterns` loaded.
- In requests to `implementer`, `reviewer` and `security-auditor` for tasks 69–91 add: "Use the `social-checklist` skill". For 51 the same for subtasks whose file says so (103–106).
- New shadcn components (51, D83): source via MCP `shadcn`, imports from `radix-ui`, written as files – no `npx shadcn add` that installs packages.

## Loop

1. Build the queue: rows of the `docs/tasks/README.md` table for the given tasks, in table order, with status `[ ]` or `[~]` without a "Blokada" section. Base branch: the umbrella branch from the decision (for 68: `feature/social`, create it from `develop` if it does not exist; for 51: `fix/ui` from `feature/social`; instead of merging `develop`, merge `feature/social` → `fix/ui` when it has new commits).
2. For each task:
   1. Depends on a blocked task (directly or indirectly) → `docs-keeper` adds "Pominięty", move on.
   2. Every 4 tasks (and before the first): `git log <umbrella branch>..develop`; when there are new commits, merge `develop` → umbrella branch (yourself, `merger` on a conflict).
   3. Create `feature/NN-<slug>` from the umbrella branch, set `[~]` in the table.
   4. When the task needs research (the "Zakres" section mentions research or a new API), first `researcher` with concrete questions; pass the result to the implementer in the request.
   5. `implementer` (short, precise request – turns drive the cost: every turn re-reads the whole context):
      - task number, branch, base branch, research results, "close the task" (status `[x]`, `git mv` to `done/`, resolutions in the decision file);
      - the files or directories to change (from "Zakres", found with one `grep` of your own if needed) and the decision bullets the task needs, quoted in the request – instead of "read the whole decision file and report" (for 68: `scope.md`, `roles-bans-blocks.md` and the area file stay as paths; for 51: quote the D83 bullets and name the report sections);
      - "mechanical changes across many files (renames, imports, keys) with one script (`sed`, codemod), not file by file; edit everything first, then run typecheck, lint, `npx vitest related <changed files> --run` and the E2E specs of affected pages once and fix in one batch".
      - Model: the `Model:` line of the task file; without it `opus` when the task touches anything from the reviewer list in step 6 or is a large refactor, otherwise pass `model: "sonnet"` to the Agent call (copy, layout, styles, simple components).
   6. `reviewer` (base: umbrella branch) only for risky tasks: permissions, bans and blocks, data isolation, public visibility, limits, deleting or moving data, races, security. Simple UI, copy and documentation – no review.
   7. `ui-checker` only for a new page or a large UI change: on the running server (no build), one variant (1280 light `/pl`; 375 dark `/pl` instead when the task changes the mobile layout), only the pages the task touched, report in at most ~20 turns. All variants only in a final audit task. May run in parallel with `reviewer`.
      For 51 (D83, changed in D84): `ui-checker` with Playwright MCP after every subtask that changes UI, with the same single-variant rule. Before the first one start the dev server yourself in the background (`npm run dev` on port 3000, log to a scratchpad file, local database after `npm run seed`) and pass its URL and the pages the subtask touched; one `ui-checker` at a time (one MCP browser). Task 107: the request names the report paths from the task file and all 8 variants; small findings go to `implementer` in the same task.
   8. Blocking findings from 6–7 → one request to `implementer` with all findings at once.
   9. Commit on the task branch: `git add -A && git commit` with the message `NN: <short english description>` and the attribution footer from the system reminder.
   10. Merge yourself: `git switch <umbrella branch> && git merge --no-ff feature/NN-<slug>`. Conflict → `git merge --abort` and `merger`.
   11. Every 3–4 tasks and before the final audit (step 3): `verifier` with the full `npm run verify` on the umbrella branch. Red → `implementer` with the diagnosis → `verifier` (up to 3 rounds; then block the task that broke it).
       `docs-keeper` only for "Blokada"/"Pominięty" sections or larger changes to `README.md`, `docs/deploy.md` (with parts in `docs/deploy/`) and the `local-setup` skill.
3. At the end (after all subtasks): `security-auditor` for `git diff develop...<umbrella branch>` (for 51: `git diff feature/social...fix/ui`); critical and high findings → implementer/verifier as in the tasks (separate commit `NN: security fixes`). Then close the umbrella task (yourself or `docs-keeper`, commit), but do not merge it into `develop` – the user does that.
4. Final report for the user: table task → status (done / blocked with reason / skipped), list of resolutions to confirm, what the user must do before the release.

## Planning a run (when writing the tasks)

- Subtask size: at most ~30 minutes of implementer work (a usage limit in the middle of an agent loses its context); split larger ones.
- Each task file gets a line `Model: sonnet` or `Model: opus` under the title (rule in step 5).
- Run it with `scripts/autorun-night.sh` (main session on Sonnet, sleeps until the limit resets) right after a limit reset, and do not use the account interactively meanwhile – the limit is shared.

## After context compaction

Restore state from the repo, not from memory: `git branch --show-current`, `git log --oneline -15 <umbrella branch>`, statuses in the `docs/tasks/README.md` table and "Blokada" sections in task files.
