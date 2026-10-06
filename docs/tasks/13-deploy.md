# 13 – Wdrożenie: Vercel + Atlas

Spec: „Cel i stack”, „Uwagi implementacyjne”, „Zmienne środowiskowe”.

## Zakres

- README: uruchomienie lokalne, zmienne środowiskowe, tworzenie konta, wdrożenie.
- Atlas: dostęp `0.0.0.0/0`, silne hasło użytkownika bazy; sprawdzić backupy dla M0 i opisać ręczny backup (np. `mongodump`).
- Vercel: zmienne `MONGODB_URI`, `AUTH_SECRET` (+ ewentualne Auth.js).
- Smoke test na produkcji: logowanie, utworzenie, zapis, eksport, share.

## Kryteria akceptacji

- Aplikacja działa na Vercelu, a kroki są powtarzalne z README.

## Testy

- `manual`: smoke test na produkcji (lista kroków w README), wynik zgłoszony użytkownikowi.
