# 17 – Nowe formaty eksportu

Zgłoszenie użytkownika (2026-10-30). Import wydzielony do taska 18. Decyzje: D31.

## Zakres

- Formaty `.docx`, `.odt`, `.pdf`, `.epub`, `.fb2`, `.html`, `.txt`, `.md` (jeden plik) dla rozdziału i folderu.
- Plik budowany w przeglądarce z JSON-a zwracanego przez serwer.
- Dialog „Export as…” z wyborem formatu i przełącznikiem komentarzy oraz notatek.

## Kryteria akceptacji

1. Rozdział i folder można wyeksportować w każdym formacie.
2. Folder to jeden dokument z rozdziałami w kolejności folderu.
3. Domyślnie plik nie zawiera komentarzy ani notatek; przełącznik je dodaje.
4. Niezapisane zmiany rozdziału są zapisywane przed eksportem, a błąd zapisu przerywa eksport.
5. Cudze i usunięte: 404, bez sesji: 401 (D1).
6. Pakiety generatorów ładują się dopiero po kliknięciu.
7. Polskie znaki są poprawne, także w PDF.
8. Eksport `.md` i `.zip` działa bez zmian.

## Testy

- Jednostkowe: `lib/export/formats.test.ts` (1, 2, 3, 7; każdy format).
- Integracyjne: `tests/integration/export-data.test.ts` (2, 5).
- E2E: `tests/e2e/export-formats.spec.ts` (1, 3, 4, 7); istniejące `export.spec.ts`, `folder-share.spec.ts` (8).
- `manual`: otwarcie plików w LibreOffice lub czytniku (1, 7); 6 – przegląd kodu (`import()` w `lib/export/build.ts`).
