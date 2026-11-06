---
name: local-setup
description: Set up and start the app locally from a freshly cloned repo: prerequisites, dependencies, .env.local, local MongoDB in Docker, migrations, dev server. Use when the user asks to set up, bootstrap or run a fresh clone, or types /local-setup.
---

# Local setup of a fresh clone

Run from the repo root. Stop and report at the first failing step; do not work around it.

1. **Prerequisites.** Check `node -v` (24 or newer, `unpdf` 2.x needs it, D34), `npm -v`, `docker info` and `docker compose version`. If something is missing or Docker is not usable by the current user (`docker` group), tell the user what to install or change and stop: system changes are theirs to make.

2. **Dependencies.** If `node_modules/` is missing or older than `package-lock.json`, ask the user, then run `npm ci` (lock file only, no new packages).

3. **`.env.local`.** If it exists, leave it as is and only check that it defines `MONGODB_URI` and a non-empty `AUTH_SECRET` (without printing values). If it does not exist:

   ```bash
   cp .env.example .env.local
   sed -i "s|^AUTH_SECRET=.*|AUTH_SECRET=$(openssl rand -base64 32)|" .env.local
   ```

   Never print `AUTH_SECRET` or show the file's contents. The default `MONGODB_URI` points at the local container (`mongodb://127.0.0.1:27017/story_app`); never point it at Atlas.

4. **Database.** `npm run db:up` (starts the `mongo:8` container and waits for its healthcheck), then `npm run migrate` (applies `migrations/` and builds indexes; the app runs with `autoIndex: false`, so this step is required).

   **Tools server (optional).** Ask the user whether to start it (needs about 1.2 GB RAM and 2.8 GB of images). If yes, run `npm run up` instead of `npm run db:up` (it starts MongoDB too): it starts Coolify and the target server in Docker, deploys the tools gateway and LanguageTool and writes `TOOLS_API_URL` and `TOOLS_API_SECRET` to `.env.local`. Report the Coolify panel URL (`http://localhost:8000`) and that the admin password is in `.tools/tools.env`; never print it. The dictionary service starts empty: `npm run dict:build` (downloads PoliMorf, 47 MB, the Polish Wiktionary dump, 138 MB, and the Dobry słownik package, 2.4 MB, and builds 410 MB, 40 MB and 23 MB files in `.tools/dict/`) and then `npm run dict:upload`; ask before running them. `npm run down` stops everything. Details: `docs/deploy.md`, section "Lokalny serwer narzędzi".

5. **Dev server.** Start `npm run dev` in the background, wait until it answers on `http://localhost:3000`, and report the URL. An account is created through "Log in / Create account" on the home page; `npm run create-account` is interactive and is run by the user, not by Claude.

6. **Tests (only if the user asks).** E2E needs Chromium: ask the user, then run `npx playwright install chromium`. After that `npm run verify` runs lint, typecheck, Vitest and Playwright; tests start the Docker container themselves and use only `story_app_test_*` / `story_app_e2e` databases.

Finish with one short line: URL of the running app, or the step that failed and why.
