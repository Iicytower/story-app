# 01 – Scaffold projektu

Spec: „Cel i stack”.

## Zakres

- Next.js (App Router) + TypeScript w katalogu głównym repo.
- Tailwind CSS + inicjalizacja shadcn/ui.
- ESLint (eslint-config-next) + Prettier (`eslint-config-prettier`, `prettier-plugin-tailwindcss`), skrypty `typecheck` (`tsc --noEmit`) i `format`.
- Vitest (jednostkowe + integracyjne, patrz `docs/testing.md`).
- `.gitignore` z `.env.local`; `.env.example` z `MONGODB_URI` i `AUTH_SECRET`.

## Kryteria akceptacji

- `npm run dev` startuje pustą aplikację.
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run format` działają (choćby z jednym przykładowym testem).
- `.env.local` nie jest śledzony przez git.

## Testy

- Vitest skonfigurowany pod jednostkowe i integracyjne (`tests/integration/`), środowisko `node`.
- Przykładowy test przechodzi; `npm test` kończy się kodem 0.
