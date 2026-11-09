# 60 – Nagłówki bezpieczeństwa

Z testów bezpieczeństwa 2026-11-07 ([F6](../security/pentest-2026-11-07.md#f6--nagłówki-bezpieczeństwa-niska)).

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
