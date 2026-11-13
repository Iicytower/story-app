# D10 – Format eksportu `.md` (2026-10-06)

Status: aktualna.

- Frontmatter generowany bez biblioteki: każda wartość (także daty ISO 8601) jako YAML double-quoted przez `JSON.stringify`, z dodatkowym escapowaniem znaków, które YAML uznaje za niedrukowalne lub za koniec linii (`U+007F–U+009F`, `U+2028`, `U+2029`, `U+FEFF`, `U+FFFE`, `U+FFFF`). Pakiet `yaml` (devDependency) tylko do parsowania w testach.
- Po frontmatterze pusta linia, potem treść bez zmian.
- Nazwa pliku: małe litery, transliteracja polskich znaków, usunięte inne diakrytyki, ciągi pozostałych znaków → `-`, max 100 znaków, fallback `story.md`.
- Bez sesji Route Handler zwraca 401 (w praktyce proxy wcześniej przekierowuje na `/login`).
- Przycisk „Export .md”: przy pustym tytule komunikat „Title is required.” bez zapisu i pobierania; w innym przypadku zapis przez tę samą kolejkę co autozapis – zawsze wywołuje `saveStory`, także bez lokalnych zmian, żeby wykryć konflikt z inną kartą – a po sukcesie pobranie przez link z atrybutem `download`.
