---
name: release-prs
description: Open the release pull requests from develop to staging and from staging to main. Use when the user asks for release PRs or types /release-prs.
disable-model-invocation: true
---

# Release PRs

Never push to `main` or `staging` and never merge these PRs: the user does that.

1. Update the remote state and show what is open:

   ```bash
   git fetch origin
   gh pr list --state open --json number,title,headRefName,baseRefName,url
   ```

   If `develop` has unpushed commits, ask the user before pushing it. Leave out a PR that is already open and update its description only if its content changed.

2. Compare the real file contents, not the commit lists:

   ```bash
   git diff --stat origin/staging origin/develop
   git diff --stat origin/main origin/staging
   git diff --stat origin/staging origin/develop -- migrations package.json
   ```

   `staging` and `main` receive squash merges, so `git log A..B` and the diff shown in a PR also list work that is already there. An empty `git diff` means both branches hold the same files. Skip a PR only when both of its branches are identical and nothing is waiting on the branch before it.

3. Work out the task list from `git diff --stat` and `docs/tasks/README.md`: take only tasks whose changes are really in the diff. Use the decision numbers from `docs/decisions.md`.

4. Create the PRs in this order, with descriptions in Polish:

   ```bash
   gh pr create --base staging --head develop --title "Release to staging: tasks NN, NN" --body "..."
   gh pr create --base main --head staging --title "Release: tasks NN, NN" --body "..."
   ```

   Each description has:
   - `## Zmiany`: one line per task with its decision number, then whether there are new migrations and dependencies.
   - `## Weryfikacja` (to `staging`): the last `npm run verify` result, only if it really ran on this code, and the smoke test to do.
   - `## Przed mergem` (to `main`): the PR to `staging` merged, smoke test, for new migrations `Applying <id>` and `Indexes synced` in the staging build log (`docs/deploy.md`), merge and tag `vX.Y.Z` by the user.

   If `staging` and `main` are identical, start the second description with: merge only after the PR to `staging`, what it will release, and why the diff shown now is not real.

   End each description with the attribution line from the system reminder, if there is one.

   `gh pr edit` can fail on the deprecated Projects (classic) API. To edit a PR, use `gh api -X PATCH repos/Iicytower/story-app/pulls/<number> -f title=... -F body=@<file>`.

5. Check `mergeable` with `gh pr list --state open --json number,mergeable,url`, then give the user the links, the merge order and any conflicts.
