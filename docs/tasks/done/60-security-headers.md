# 60 – Nagłówki bezpieczeństwa

Z testów bezpieczeństwa 2026-11-07 ([F6](../../security/pentest-2026-11-07.md#f6--nagłówki-bezpieczeństwa-niska)).

## Zakres

- `Content-Security-Policy` (z nonce albo hashem dla skryptu motywu z `InlineScript` i skryptów Next.js), w tym `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`.
- `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` bez zbędnych uprawnień, `X-Frame-Options: DENY` dla starszych przeglądarek.
- `poweredByHeader: false`.
- HSTS: decyzja, czy polegać na Vercelu, czy ustawiać samemu (self-hosting).

Sprawdzić w aktualnej dokumentacji Next.js (`node_modules/next/dist/docs/`), jak ustawić CSP z nonce w proxy i jak to wpływa na statyczne renderowanie.

## Kryteria akceptacji

1. Strony aplikacji i strony publiczne mają powyższe nagłówki; brak `X-Powered-By`.
2. Aplikacja działa bez naruszeń CSP w konsoli (edytor, podgląd markdown, motyw, przełącznik języka, eksport/import).
3. Strona nie daje się osadzić w ramce.

## Testy

E2E: nagłówki odpowiedzi strony głównej, edytora i strony publicznej; brak `securitypolicyviolation` na głównych ścieżkach.

## Wynik (2026-11-10)

Decyzje: D77. `lib/security-headers.ts` (polityka i nagłówki), `proxy.ts` (nonce i CSP), `next.config.ts` (`headers()`, `poweredByHeader: false`), nonce w `InlineScript` (`app/[locale]/layout.tsx`).

Mapowanie kryteriów:
1. Nagłówki na stronach aplikacji i publicznych, brak `X-Powered-By` – E2E `tests/e2e/security-headers.spec.ts` (strona główna, edytor, publiczny spis folderu; nowy nonce przy każdym żądaniu).
2. Brak naruszeń CSP (edytor, podgląd markdown, motyw, przełącznik języka, eksport/import) – fixture w `tests/e2e/helpers.ts` oblewa każdy test E2E z naruszeniem, więc obejmuje cały zestaw (edytor, Preview/Source, motyw, `polish.spec.ts`, `export*.spec.ts`, `import.spec.ts` itd.). Dwa uzasadnione wyjątki opisane w D77. `manual`: `next dev` z CSP – strona główna, logowanie i lista opowiadań bez naruszeń i błędów (2026-11-10).
3. Strona nie daje się osadzić w ramce – E2E „the app cannot be framed” (ramka z innego origin kończy się stroną błędu Chromium).

`manual` (użytkownik, staging): w DevTools → Network odpowiedź strony ma `Content-Security-Policy` z nonce, a konsola nie pokazuje naruszeń przy edycji, imporcie i eksporcie. Vercel może dodać własny HSTS; podwójny nagłówek nie szkodzi.
