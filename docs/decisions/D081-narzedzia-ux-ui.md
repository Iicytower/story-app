# D81 – Narzędzia Claude do UX i UI (2026-11-12)

Status: aktualna.

- Bez taska, decyzje użytkownika. Cel: poprawa UX i UI aplikacji z pomocą Claude Code.
- Skille w `.claude/skills/` (kopie przejrzane przed dodaniem, bez skryptów): `frontend-design` (`anthropics/skills` @ `2c5958e`), `ux-heuristics` (`wondelai/skills` @ `d8d5d75`, MIT), `web-design-guidelines` (`vercel-labs/agent-skills` @ `1a2c79d`, MIT). Kopie bez zmian formatowania (`.prettierignore`). Reguły Vercela przypięte w `guidelines.md` zamiast pobierania przy każdym użyciu; aktualizacja tylko na prośbę użytkownika. Dopisane uwagi projektowe (copy w `messages/*.json`, Title Case tylko po angielsku).
- MCP w `.mcp.json`: `shadcn` (lokalny pakiet `shadcn`, rejestr komponentów) i `playwright` (`@playwright/mcp@0.0.85 --browser chromium` – w systemie nie ma Google Chrome, domyślnego kanału; zrzuty w ignorowanym `.playwright-mcp/`). Claude in Chrome zablokowany w projekcie (`deny: mcp__claude-in-chrome` w `.claude/settings.json`); zastępuje go Playwright MCP.
- Odrzucone: Impeccable (pobiera binarkę silnika i dodaje hooki SessionStart/PostToolUse/Stop), UI/UX Pro Max (generator design systemu, lepszy dla nowych projektów).
