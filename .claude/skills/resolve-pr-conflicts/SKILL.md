---
name: resolve-pr-conflicts
description: Resolve merge conflicts in all open pull requests, including the false ones left by squash releases between develop, staging and main. Use when the user asks to fix PR conflicts or types /resolve-pr-conflicts.
---

# Resolve PR conflicts

Never push to `main` and never merge a PR: the user does that. Invoking this skill is the user's permission to push the head branch of a conflicting PR, including `staging`.

1. List the open PRs. GitHub computes `mergeable` lazily, so repeat for any `UNKNOWN`:

   ```bash
   git fetch origin
   gh pr list --state open --json number,title,mergeable,headRefName,baseRefName,url
   ```

   If nothing is `CONFLICTING`, say so and stop.

2. For each `CONFLICTING` PR, list the files and check whether the base holds anything the head lacks. `staging` and `main` receive squash merges, so most conflicts are false: the base's tree is an older state of the head.

   ```bash
   git merge-tree --write-tree --name-only origin/<head> origin/<base>
   git log --format='%h %T %s' origin/<head> | grep "$(git rev-parse origin/<base>^{tree})"
   ```

3. **The base's tree is in the head's history** (false conflict): record the merge without changing any file.

   ```bash
   git switch <head> && git pull --ff-only origin <head>
   git merge -s ours origin/<base> -m "Merge <base> into <head> (squashed release #<PR that made the squash>, no new changes)"
   git rev-parse HEAD^{tree} origin/<head>^{tree}   # must be equal
   git push origin <head>
   git switch -
   ```

4. **The tree is not in the history** (real conflict, e.g. a hotfix on `main`): do not use `-s ours`, it would drop that change. Run a normal `git merge origin/<base>`, resolve each file keeping both sides' intent, run `npm run verify`, then commit and push. If two sides change the same behaviour and the right result is not clear, ask the user with `AskUserQuestion`. If the head is `main`, stop and tell the user.

5. Check every PR again, waiting for `UNKNOWN` and for checks (`gh pr checks <number>`):

   ```bash
   gh pr list --state open --json number,mergeable,url
   ```

   Give the user the result per PR and the merge order: `develop` → `staging` before `staging` → `main`.
