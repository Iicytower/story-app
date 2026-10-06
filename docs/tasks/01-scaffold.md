# 01 – Scaffold projektu

Spec: „Cel i stack”.

## Zakres

- Next.js (App Router) + TypeScript w katalogu głównym repo.
- Tailwind CSS + inicjalizacja shadcn/ui.
- ESLint (eslint-config-next) + Prettier (`eslint-config-prettier`, `prettier-plugin-tailwindcss`), skrypty `typecheck` (`tsc --noEmit`) i `format`.
- Vitest (testy jednostkowe – potrzebne m.in. dla `stripComments`).
- `.gitignore` z `.env.local`; `.env.example` z `MONGODB_URI` i `AUTH_SECRET`.

## Kryteria akceptacji

- `npm run dev` startuje pustą aplikację.
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run format` działają (choćby z jednym przykładowym testem).
- `.env.local` nie jest śledzony przez git.
