---
name: social-checklist
description: Checklist for code of the social system (tasks 68–91, D80) – permissions, visibility, bans and blocks, limits, markdown, notifications. Use when implementing, reviewing or auditing any social feature.
---

# Social system checklist (D80)

Source of truth: `docs/decisions/D080-system-spolecznosciowy/` (always `scope.md` and `roles-bans-blocks.md`, plus the task's area file; list of parts in `index.md`) and the task file. For every action and every read check:

1. **Session and owner**: `requireUser()`, `userId` from the session, D71 guards, `{ ok, ... }` result without exceptions.
2. **Permissions** only through `lib/social/permissions.ts` (`canInteract`, `hiddenAuthorsFor` etc.): ban in the author's community, global ban (read-only), block in both directions, disabled comments, role (admin, author's moderator, category moderator), the DM setting "who can write". Never a condition only in a component.
3. **Visibility** on read: public object per D38 (folder `published`, chapter `public`, both without `deletedAt`), content of globally banned users and of users blocked by the viewer filtered out, private library invisible, anonymous ratings (never the rater's `userId` in a response).
4. **Someone else's / invisible → `NOT_FOUND`**, also for moderation outside your own community.
5. **Limits**: lengths from `lib/limits.ts`, per-account antispam (`takeUserAttempt`, half for accounts < 24 h), count limits (shelves, bookmarks, moderators, mentions).
6. **Markdown** through `components/social-markdown.tsx` (element allowlist, no `rehype-raw`, links `nofollow ugc noopener`).
7. **Notifications and activity** through the shared helpers (task 81, `recordActivity`), skipping blocked users and disabled kinds.
8. **Queries** with an index and a result limit; counters without fetching whole collections.
9. **i18n**: every string in `messages/en.json` and `pl.json`, ICU for plurals, relative dates via `Intl`.
10. **Tests**: every case of ban, block and global ban separately; user isolation; guest (read yes, write → login dialog).
