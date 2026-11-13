# Story App

@AGENTS.md

**Talk to the user in Polish.** Everything else in this file and in `.claude/` is in English.

Web app for writing stories (to become public, D46) in markdown (Next.js App Router, TypeScript, MongoDB Atlas + Mongoose, Auth.js Credentials/JWT, Tailwind + shadcn/ui, Vercel).

## Documentation

- `docs/spec.md` – functional specification (copy of a Claude Docs document; do not edit unless asked).
- `docs/decisions/` – decisions and deviations from the spec; **they override the spec**. One file per decision (`DNNN-slug.md`; D80 is the folder `D080-system-spolecznosciowy/` with `index.md` and area files), index `index.md` (current decisions by topic, archived ones separately, one sentence per decision). New decision, change or archiving of an older one: follow D82 (`D082-decyzje-w-plikach.md`) – a file with a status line and a row in the index.
- `docs/testing.md` – test strategy (unit / integration with MongoDB in Docker / E2E Playwright). **Mandatory for every task.**
- `docs/tasks/README.md` – task list with statuses, branches and the definition of "done"; details of open tasks in `docs/tasks/NN-*.md` (sections "Zakres" (scope), "Kryteria akceptacji" (acceptance criteria), "Testy" (tests)), finished ones in `docs/tasks/done/`. Open tasks are listed in the table in execution order.
- `README.md` (English) – short, marketing-style description of the app, the stack, the workflow with Claude Code and local setup (manual and with the `/local-setup` skill). Update it in the task that changes any of those sections (e.g. stack, commands, requirements, setup steps, skills, hooks); when setup steps change, also fix `.claude/skills/local-setup/SKILL.md`. The domain description stays general (a few sentences), no feature list.
- `docs/deploy.md` – environments (production, staging), releases, Vercel and Atlas settings; parts in `docs/deploy/` (`migrations.md`, `tools.md` – local stack and Mikrus, `backup.md`).

## Working on tasks

1. Before starting, read the task file and the referenced spec sections and decision files.
2. Create branch `feature/NN-<slug>` from `develop` and set status `[~]` in `docs/tasks/README.md`. Exception: social system tasks (68–91, D80) – branch from `feature/social` and merge into it; the user merges `feature/social` into `develop`.
3. Ambiguities or several reasonable solutions → ask before implementing.
4. Write the tests from the task's "Testy" section together with the code (not at the end). Every acceptance criterion must have a test or be marked `manual`.
5. `npm run verify` must pass. Do not close a task with red or skipped tests.
6. In the reply to the user, give the mapping: acceptance criterion → test (or the result of the `manual` check).
7. Status `[x]`, move the task file to `docs/tasks/done/` (`git mv`) and fix the link in the table, then one commit per task on the task branch (message: `NN: <short description>`). Merge into `develop` when the task is finished; push `develop` only when the user asks. Commit messages and PR titles are in English; PR descriptions are in Polish. **Never merge into `staging` or `main` and never push to `staging`, `main` or `master`** – only the user does that, also when asked for tests on staging (D45).

## Commands

- `npm run dev` / `build` / `lint` / `typecheck` / `format`
- `npm test` (Vitest: unit + integration), `npm run test:e2e` (Playwright), `npm run verify` (everything)
- Tests never use the database from `.env.local` – only the `story_app_test_*` / `story_app_e2e` databases in the Docker container (`docker-compose.yml`, started automatically in `globalSetup`).
- `npm run db:up` – local MongoDB in Docker (dev: `MONGODB_URI=mongodb://127.0.0.1:27017/story_app`).
- `npm run up` / `down` – the whole stack locally: MongoDB, Coolify and the tools server in Docker (task 54, `docs/deploy/tools.md`); `up` writes `TOOLS_API_URL` and `TOOLS_API_SECRET` to `.env.local`. Secrets are in `.tools/` – never print them.
- `npm run tools:remote` / `dict:upload:remote` – the tools server on Mikrus over SSH (task 28, config in `.tools/mikrus/remote.env`, instructions in `docs/deploy/tools.md`).
- `npm run migrate` – database migrations against `.env.local` (`migrations/`, D14). On Vercel they run automatically in the production and staging builds.
- `npm run seed` – data for manual testing: `seed_*` accounts (one admin) with a shared password, books and social data; local database only (`127.0.0.1`/`localhost`), each run recreates only the seed accounts' data.
- `npm run create-account` – interactive script that adds an account (run by the user, not by Claude).
- `npm run tags -- list|set <key> <en> <pl>|remove <key>` – predefined tags in the `.env.local` database (D79; changes are run by the user).
- `npm run admin -- list|add <nick>|remove <nick>` – admin list (`User.role`, D80) in the `.env.local` database (changes are run by the user).
- Package manager: npm. Install packages only with the user's consent.

## Project rules

- Multilingual UI (D46): English and Polish, chosen in the sidebar; dark mode. Designed for desktop; the home page (D54) and the editor (D12) also work on narrow screens.
- Multiple users (D1): every `stories` query filters by `userId` from the session; someone else's = `NOT_FOUND`/404. `userId` never comes from client input.
- Reads: Server Components straight from the database. Writes: Server Actions. Route Handlers only for export and Auth.js.
- Every Server Action checks the session and returns `{ ok: true, ... } | { ok: false, error, message }` – it does not throw.
- Story queries always include `deletedAt: null` (including the public page, which requires it too).
- Mongoose: `.lean()` + serialization (`_id` → `id: string`, dates → ISO string) before passing to the client; models registered with `mongoose.models.X ?? mongoose.model(...)`.
- Pages live in `app/[locale]/` (D46). `Link`, `redirect`, `useRouter`, `usePathname`, `getPathname` only from `@/i18n/navigation`, never from `next/link` / `next/navigation`. Route Handlers (export, `api/`) outside `[locale]`.
- Every UI string is in `messages/en.json` and `messages/pl.json` (D46; a key missing in `pl` is a `tsc` error): `useTranslations` / `getTranslations`, also for `aria-label`, `placeholder`, `title`, `metadata`. Plurals via ICU (`{count, plural, ...}`). Server Action messages via `actionError(code, key)` from `lib/i18n/action-error.ts`; validation in `lib/` returns a key (`ValidationError`), the action translates it with `translateError`.
- Markdown preview: `react-markdown` + `remark-breaks`, never `rehype-raw`.
- Check library APIs (Next.js, Auth.js, Mongoose, shadcn) in current documentation, not from memory – versions change fast (how to look things up: "Saving context").

## Claude automation (`.claude/`)

- Hooks: PostToolUse – ESLint `--fix` + Prettier on the edited file; Stop and SubagentStop (`implementer`, `verifier`, `merger`) – `tsc --noEmit` when TS files changed, errors must be fixed; PreToolUse – `protect-branches.sh` (D45). The `/autorun` hooks are described in the `autorun` skill.
- Agents (`.claude/agents/`): `researcher`, `implementer`, `verifier`, `reviewer`, `ui-checker`, `security-auditor`, `docs-keeper`, `merger`; skills `test-patterns` (in `implementer` and `verifier`) and `social-checklist` (tasks 68–91). Agents that write files work one at a time (single working tree). Models: Opus for `implementer`, `reviewer`, `security-auditor`; Sonnet for the rest. In `/autorun` (D84) the main session runs on Sonnet and simple UI tasks pass `model: "sonnet"` to `implementer` (the task file's `Model:` line). Small changes (a few files, no new permission logic) are done by the main session itself, without an agent.
- Skill `/autorun <umbrella task>`: runs tasks without the user.
- Design (D81): skills `frontend-design`, `ux-heuristics`, `web-design-guidelines` (rules pinned in `guidelines.md`, no fetching); MCP `shadcn` and `playwright` in `.mcp.json`. Claude in Chrome is blocked in the project – use the browser through Playwright MCP.

## Saving context

- Decisions: first the index `docs/decisions/index.md`, then only the files of the decisions you need, from its links (for D80 only the area files you need). Do not read archived decisions unless the status points to a part that is still valid or the question is about history.
- Files over about 300 lines (`messages/*.json`, large components, documents): read with `grep -n` and a line range, not whole.
- Next.js documentation (AGENTS.md): only for a new or uncertain API – `grep -rln "<api>" node_modules/next/dist/docs/` and read the fragment found, or context7. Do not read whole guides "just in case". Other libraries – context7.
- Tests: `dot` reporter (Vitest prints console output only for failed tests). Per change run `npx vitest related <files> --run` and the specs of affected pages; the full `npm run verify` less often (before a merge, every few tasks).
- Trim the output of long commands (`| tail -n 40`); write server logs to a file and read them in parts.
