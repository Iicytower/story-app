# 04 – Eksport i udostępnianie folderu

Zależy od 03. Nowy pakiet: `fflate` (zgoda użytkownika przed startem).

## Zakres

- **Eksport `.zip`:** `GET /folders/[id]/export` (Route Handler).
  - Każdy rozdział jako `.md` w formacie z D10, w kolejności z `chapterSort`.
  - Nazwy plików z prefiksem numeru (`01-<bezpieczna-nazwa>.md`), żeby kolejność zachowała się w systemie plików.
  - Notatki folderu jako `notes.md`.
  - Nazwa archiwum: bezpieczna nazwa folderu.
  - Bez sesji 401, cudzy lub usunięty folder 404.
- **Udostępnianie folderu:** `shareToken` w `folders` (ten sam mechanizm co D11, osobny indeks unikalny częściowy), akcja `setFolderSharing`.
  - `/s/f/[token]`: nazwa folderu i spis rozdziałów w kolejności z `chapterSort`.
  - `/s/f/[token]/[n]`: rozdział nr `n` z linkami poprzedni/następny.
  - Bez notatek (folderu i rozdziałów), komentarze usunięte przez `stripComments`, `noindex`, `connection()`.
- Udostępnianie pojedynczego rozdziału (`/s/[token]`) działa niezależnie, jak dotąd.
- „Stop sharing” lub usunięcie folderu wyłącza link (404). Usunięty rozdział znika ze spisu.
- Przyciski „Export .zip” i „Share” / „Stop sharing” w widoku folderu.
- Migracja nie jest potrzebna, bo brak `shareToken` oznacza folder prywatny. Indeks tworzy `syncIndexes()`.

## Kryteria akceptacji

1. Zip zawiera rozdziały w kolejności folderu (z numerami) oraz `notes.md`. Każdy plik ma frontmatter jak w D10.
2. Eksport: 401 bez sesji, 404 dla cudzego i usuniętego folderu.
3. Share daje link `/s/f/<token>`, a ponowne Share zwraca ten sam token. Stop sharing → 404.
4. Strona udostępnionego folderu pokazuje spis i rozdziały, bez notatek i komentarzy HTML (sprawdzone w HTML odpowiedzi), z `noindex`.
5. Usunięcie folderu → 404 pod linkiem. Usunięty rozdział znika ze spisu.
6. Share folderu i share rozdziału nie wpływają na siebie nawzajem.

## Testy

- Jednostkowe: budowa zawartości zip (nazwy plików z numerami, `notes.md`), parsowanie zipa przez `fflate` w teście.
- Integracyjne: `setFolderSharing` (3, 6), zapytania strony publicznej (4, 5).
- E2E: pobranie zipa (1, 2), link w nowym kontekście bez sesji (4, 5).
