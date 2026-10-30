# 26 – Okładki

Zgłoszenie użytkownika (2026-10-30). Upload okładki do rozdziału lub folderu, pliki w Cloudflare R2. Obrazki w tekście są poza zakresem (backlog).

## Zakres

- Dodanie, wymiana i usunięcie okładki rozdziału oraz folderu.
- Rozdział bez własnej okładki pokazuje okładkę folderu.
- Skalowanie i kompresja obrazka w przeglądarce przed wysłaniem.
- Upload bezpośrednio z przeglądarki do R2 przez krótko ważny podpisany adres wydawany przez Server Action.
- Wyświetlanie okładek w widokach ustalonych przy starcie taska.

## Ustalenia

- Storage: Cloudflare R2, bo Vercel jest na planie free (decyzja użytkownika).
- W bazie tylko ścieżka pliku (np. `covers/<id>.webp`), adres to `IMAGES_BASE_URL` + ścieżka. Zmiana serwera to skopiowanie plików z tymi samymi ścieżkami i zmiana tej wartości, bez migracji danych.
- Nazwę pliku generuje aplikacja. Nowa okładka to nowy plik, a stary jest usuwany.
- Klucze R2 tylko na serwerze. Osobne buckety dla produkcji i stagingu, jak osobne bazy (D13).
- Użytkownik nie ma własnej domeny.

Do decyzji przy starcie taska (wynik jako nowa decyzja w `decisions.md`):

- Adres publiczny bez własnej domeny: `r2.dev` (sprawdzić aktualne limity i przeznaczenie), proxy przez aplikację albo zakup domeny.
- Klient S3 (nowy pakiet, wymaga zgody) czy własne podpisywanie.
- Widoki z okładką: lista folderów, strona folderu, panel Chapters, edytor, strony publiczne.
- Docelowy format, rozmiar, proporcje, kadrowanie oraz maksymalny rozmiar pliku wejściowego.
- Zachowanie plików przy soft delete: usuwać od razu czy dopiero przy trwałym usunięciu.
- Czy okładka jest częścią eksportu (`.epub`, `.docx`, `.pdf`), importu i wersji folderów (D25).
- Backup plików z R2, bo `scripts/backup.sh` obejmuje tylko bazę (D26).
- Ochrona przed podmianą cudzego pliku i przed wskazaniem ścieżki spoza `covers/`.

## Kryteria akceptacji

1. Właściciel może dodać, wymienić i usunąć okładkę rozdziału i folderu.
2. Rozdział bez okładki pokazuje okładkę folderu, a rozdział z okładką własną.
3. Usunięcie okładki rozdziału wraca do okładki folderu; rozdział i folder bez okładek nie pokazują uszkodzonego obrazka.
4. Przeniesienie rozdziału bez własnej okładki pokazuje okładkę nowego folderu.
5. Do R2 trafia tylko obrazek po przeskalowaniu, a plik o złym typie lub zbyt duży daje komunikat.
6. Wymiana i usunięcie okładki usuwają stary plik z R2.
7. Baza trzyma tylko ścieżkę, a zmiana `IMAGES_BASE_URL` zmienia adresy wszystkich okładek.
8. Podpisany adres wydaje tylko właściciel; cudzy rozdział lub folder daje `NOT_FOUND`, a klucze R2 nie trafiają do klienta.
9. Błąd uploadu daje komunikat i zostawia poprzednią okładkę.
10. Zmiana okładki nie zmienia `updatedAt` rozdziału (jak D11), więc otwarty edytor nie dostaje `CONFLICT`.

## Testy

Unit: składanie adresu, wybór okładki z fallbackiem do folderu, walidacja typu i rozmiaru, skalowanie. Integracyjne: akcje okładek, własność, usuwanie starego pliku, migracja (R2 zastąpione atrapą, bez wywołań sieciowych). E2E: dodanie, wymiana i usunięcie okładki, fallback rozdziału do folderu. `manual`: prawdziwy upload na stagingu i wyświetlanie przez adres R2.
