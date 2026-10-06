# 11 – Eksport .md

Spec: „Eksport”, „Server Actions i Route Handlers”.

## Zakres

- Route Handler `GET /stories/[id]/export`: sesja wymagana, 404 dla usuniętych i cudzych, odpowiedź z `Content-Disposition: attachment`.
- Plik: frontmatter YAML (`title`, `createdAt`, `updatedAt`, `notes`; bezpieczne cytowanie, daty ISO 8601), potem treść z komentarzami HTML.
- Nazwa pliku: tytuł → bezpieczna nazwa (transliteracja polskich znaków, bez znaków specjalnych), fallback gdy wynik pusty.
- Przycisk „Export .md”: najpierw `saveStory`, po sukcesie pobranie pliku; przy błędzie komunikat, bez pobierania.

## Kryteria akceptacji

- Wyeksportowany plik parsuje się poprawnie jako YAML frontmatter.

## Testy

- Jednostkowe: generowanie frontmatteru (cudzysłowy, dwukropki, wielolinijkowe notatki, pusty string) – wynik parsowany z powrotem parserem YAML daje te same wartości; nazwa pliku (polskie znaki, znaki specjalne, sam tytuł ze znaków specjalnych → fallback).
- Integracyjne / Route Handler (wywołanie `GET` bezpośrednio): bez sesji → brak dostępu, usunięte i cudze → 404, nagłówek `Content-Disposition` z bezpieczną nazwą, treść zawiera komentarze HTML.
- E2E `tests/e2e/export.spec.ts`: kliknięcie „Export .md” → `page.waitForEvent('download')`; pobrany plik zawiera niezapisaną wcześniej zmianę; przy błędzie zapisu (np. duplikat tytułu) brak pobrania i komunikat.
