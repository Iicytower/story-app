# Story App

Your stories, from the first line to the first reader. Story App gives writers a calm, distraction-free place to draft books chapter by chapter, keep notes and versions close at hand, and publish their work with a single click. Readers discover it through public search and dive straight in, then follow authors, keep books in their library, comment, react, rate and talk in forums and direct messages, with moderation by authors and admins. The interface is available in English and Polish.

## Tech stack

| Area      | Choice                                                                                                                                                                |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework | Next.js 16 (App Router, Server Components, Server Actions), React 19, TypeScript                                                                                      |
| Data      | MongoDB (Atlas in the cloud, Docker locally) with Mongoose                                                                                                            |
| Auth      | Auth.js v5, Credentials provider, JWT sessions, `bcryptjs`                                                                                                            |
| UI        | Tailwind CSS 4, shadcn/ui (Radix), Tiptap v3, `react-resizable-panels`, `dnd-kit`, `next-intl`, `recharts`, `cmdk`, `sonner`                                          |
| Tests     | Vitest (unit and integration against a real MongoDB), Playwright (E2E)                                                                                                |
| Hosting   | Vercel (production and staging), MongoDB Atlas                                                                                                                        |
| Tools     | Self-hosted tools server managed by Coolify (proofreading, dictionaries, cover classifier, realtime Server-Sent Events); locally Coolify and the server run in Docker |

The main architectural rules:

- Server Components read directly from the database, and Server Actions write. Route Handlers exist only for export and Auth.js.
- Every query is scoped to the `userId` from the session. Another user's data looks like it does not exist (404).
- Every Server Action checks the session and returns `{ ok: true, ... } | { ok: false, error, message }` instead of throwing.
- Indexes and data changes are managed by a custom migration runner (`migrations/`). Migrations are expand-only, back up the affected collections first, and run automatically in the Vercel build.

## How it is built

The app is developed with [Claude Code](https://claude.com/claude-code) following a written, test-first process. The documentation in `docs/` is the source of truth for both the human and the agent:

- **`docs/spec.md`**: the original functional specification.
- **`docs/decisions.md`**: numbered decisions (D1, D2, …) recording every change to the spec and every non-obvious choice. Decisions override the spec; large ones live in `docs/decisions/` (e.g. the social system in `docs/decisions/d80/`).
- **`docs/tasks/`**: one file per task with scope, acceptance criteria and the tests that cover them. Each task runs on its own `feature/NN-<slug>` branch from `develop` and ends with a single commit.
- **`docs/testing.md`**: every acceptance criterion maps to a unit, integration or E2E test, or is explicitly marked `manual`. A task is done only when `npm run verify` (lint, typecheck, Vitest, Playwright) passes.
- **`docs/deploy.md`**: environments, releases, migrations and backups.

The agent is constrained by project configuration in `.claude/`:

- **`CLAUDE.md` / `AGENTS.md`**: project rules, workflow and commands.
- **Hooks**: ESLint and Prettier run after every edit, `tsc` runs before the agent finishes, and a guard blocks merges and pushes to `staging` and `main`. Releases (`develop` → `staging` → `main`) are made only by the human.
- **Skills**: repeatable procedures such as `/tasks`, `/release-prs`, `/resolve-pr-conflicts`, `/local-setup` and `/autorun`, which works through a group of tasks unattended.
- **Subagents** (`.claude/agents/`): researcher, implementer, verifier, reviewer, UI checker, security auditor, docs keeper and merger. The main session orchestrates and delegates the work to keep its context small; Opus for implementation, review and security audit, Sonnet for the rest.

## Running locally

Requirements: Node.js 24+, npm, and Docker with Compose (your user must be able to run `docker`).

### With Claude Code

Open the repo in Claude Code and run:

```
/local-setup
```

The skill checks the requirements, installs dependencies, creates `.env.local` with a generated secret, starts MongoDB, applies migrations and starts the dev server.

### Manually

```sh
git clone git@github.com:Iicytower/story-app.git
cd story-app
npm ci

cp .env.example .env.local
# set AUTH_SECRET in .env.local, e.g. to the output of:
openssl rand -base64 32

npm run db:up      # MongoDB 8 in Docker on 127.0.0.1:27017
npm run migrate    # collections and indexes (the app does not create indexes itself)
npm run dev        # http://localhost:3000
```

Create an account with "Log in / Create account" on the home page, or from the terminal with `npm run create-account`. Run `npm run migrate` again after pulling changes that touch schemas or `migrations/`. The list of predefined tags (genres and forms) comes with the migrations; `npm run tags -- list|set|remove` changes it. `npm run admin -- list|add <nick>|remove <nick>` lists, grants or revokes the admin role (database from `.env.local`).

### Everything at once, with the tools server

```sh
npm run up         # MongoDB, Coolify (panel on http://localhost:8000) and the tools server
npm run down       # stops all of it; the data stays in Docker volumes
npm run dict:build # builds the dictionary databases from PoliMorf, the Polish Wiktionary, the Dobry słownik thesaurus and wordfreq (downloads 190 MB once)
npm run dict:upload # sends them to the dictionary service on the tools server
```

`npm run up` starts Coolify and a Docker-in-Docker container that plays the remote tools server, deploys the tools gateway, LanguageTool (used for proofreading), the dictionary service, the cover classifier (an ONNX model that rates folder covers) and the realtime service (Server-Sent Events for notifications and messages; set `REALTIME_PUBLIC_URL=http://127.0.0.1:8110` in `.env.local` to use it, otherwise the app polls) to it through the Coolify API and writes `TOOLS_API_URL` and `TOOLS_API_SECRET` to `.env.local`. Running it again changes nothing unless `docker/tools/compose.yml` changed (then it redeploys the service). Generated secrets stay in `.tools/` (gitignored); the Coolify admin password is in `.tools/tools.env`. The stack needs about 1.2 GB of RAM and 2.8 GB of images (half of them pulled inside the tools server container). Details: `docs/deploy.md`.

The production tools server (a Mikrus VPS) is set up from your machine over SSH: `npm run tools:remote` installs Docker and Coolify there and deploys the same services, and `npm run dict:upload:remote` sends the databases. Step by step: `docs/deploy.md`, "Serwer narzędzi na Mikrusie".

### Tests

```sh
npx playwright install chromium   # once, for E2E
npm test                          # unit + integration
npm run test:e2e                  # Playwright
npm run verify                    # lint, typecheck, all tests
```

Tests start the Docker container themselves and use only their own `story_app_test_*` and `story_app_e2e` databases, never the one from `.env.local`.
