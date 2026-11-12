# D7 – Tytuł przycinany (trim) (2026-10-06)

Status: aktualna.

- Serwer (`createStory`, później `saveStory`) zapisuje tytuł po `trim()`. Tytuł z samych białych znaków → `EMPTY_TITLE`. Unikalność liczona po przycięciu (`" A "` koliduje z `"A"`).
- Wynik akcji typowany jako `ActionResult<T>` (`lib/action-result.ts`). Akcje opowiadań w `app/(protected)/stories/actions.ts`; nieprawidłowe `id` (nie ObjectId) → `NOT_FOUND`.
