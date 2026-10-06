# 10 – Eksport .md

Spec: „Eksport”, „Server Actions i Route Handlers”.

## Zakres

- Route Handler `GET /stories/[id]/export`: sesja wymagana, 404 dla usuniętych i cudzych, odpowiedź z `Content-Disposition: attachment`.
- Plik: frontmatter YAML (`title`, `createdAt`, `updatedAt`, `notes`; bezpieczne cytowanie, daty ISO 8601), potem treść z komentarzami HTML.
- Nazwa pliku: tytuł → bezpieczna nazwa (transliteracja polskich znaków, bez znaków specjalnych), fallback gdy wynik pusty.
- Przycisk „Export .md”: najpierw `saveStory`, po sukcesie pobranie pliku; przy błędzie komunikat, bez pobierania.
- Testy jednostkowe: generowanie frontmatteru (cudzysłowy, dwukropki, wielolinijkowe notatki) i nazwy pliku.

## Kryteria akceptacji

- Wyeksportowany plik parsuje się poprawnie jako YAML frontmatter.
