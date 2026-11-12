# D48 – Słownik i komunikaty generowane (2026-11-03)

Status: aktualna.

- Jeden plik `messages/en.json` z przestrzeniami nazw według obszaru; typy kluczy z `en` (`types/next-intl.d.ts`), więc brakujący klucz w innym języku to błąd `tsc` (decyzja użytkownika).
- Walidacja w `lib/` nie zależy od `next-intl`: zwraca klucz i wartości (`ValidationError`, `ErrorMessage`), a Server Action tłumaczy je na serwerze (`translateError` / `actionError` z `lib/i18n/action-error.ts`). Klient tłumaczy klucze sam (wymagania hasła, błędy importu `ImportError.key`). Poza żądaniem (skrypt `create-account`, rzucane błędy) tekst jest po angielsku przez `inEnglish` (decyzja użytkownika).
- Teksty generowane do treści (tytuł „Chapter N” przy imporcie, nagłówki „Notes” i „Folder notes” w eksporcie, nazwa wersji „Before restoring version N”) są w języku interfejsu w chwili utworzenia; zapisane dane się nie zmieniają (decyzja użytkownika).
- Import rozpoznaje nagłówki „Notes” i „Folder notes” wszystkich języków z listy `DOCUMENTS` w `lib/i18n/english.ts`. Nowy język trzeba tam dopisać (poza plikiem `messages/xx.json` i listą języków w `i18n/routing.ts`).
- Strona 404 poza prefiksem języka (`app/not-found.tsx`) zostaje po angielsku: nie ma z czego wziąć języka.
