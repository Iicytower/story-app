# 24 – Tagi i wyszukiwanie publicznych opowiadań

Zgłoszenie użytkownika (2026-10-30). Publiczne wyszukiwanie zmienia dotychczasowe założenie, że opowiadanie widzi tylko ktoś, kto zna link (D11, D18).

## Zakres

- Tagi na folderach i rozdziałach, z podpowiedziami z własnych tagów użytkownika.
- Filtrowanie po tagach własnych opowiadań na `/stories`, razem z istniejącym wyszukiwaniem.
- Przełącznik „Publish” na rozdziale i folderze, niezależny od „Share”. Domyślnie wyłączony, także dla wszystkiego, co ma dziś aktywny link.
- Publiczna strona wyszukiwania dostępna bez logowania: wyszukiwanie po tytule, tagach i treści opublikowanych opowiadań, z wynikami prowadzącymi do strony czytania.
- Limit zapytań na publicznej stronie, bo nie ma przed nią logowania.

## Ustalenia

- Do wyszukiwania trafia tylko to, co autor opublikował osobną zgodą. Aktywny link udostępniania niczego nie publikuje (decyzja użytkownika).
- Tagi na obu poziomach; wyszukiwanie uwzględnia oba (decyzja użytkownika).
- Wyszukiwanie obejmuje tytuł, tagi i treść (decyzja użytkownika).

Do decyzji przy starcie taska (wynik jako nowa decyzja w `decisions.md`):

- Sposób wyszukiwania w treści: indeks tekstowy MongoDB, Atlas Search albo wektoryzacja całości. Porównanie obejmuje polską odmianę, limity Atlas M0, koszt embeddingów, moment ich liczenia i prywatność tekstu wysyłanego do dostawcy.
- Czy rozdział w opublikowanym folderze jest publiczny razem z nim, czy wymaga własnej zgody, oraz czy dziedziczy tagi folderu w wynikach.
- Adres strony czytania opublikowanego opowiadania: token z „Share” czy osobny adres, skoro „Publish” działa bez „Share”.
- Co widać w wynikach przy autorze. Dziś konto ma tylko e-mail, którego nie wolno pokazać, więc potrzebny jest pseudonim albo brak autora.
- Czy strona wyszukiwania i opublikowane opowiadania są indeksowane przez wyszukiwarki, czy zostają przy `noindex`.
- Mechanizm limitu zapytań na Vercelu.
- Normalizacja i limity tagów (długość, liczba, wielkość liter).

## Kryteria akceptacji

1. Tagi można dodawać i usuwać na folderze i na rozdziale, a podpowiedzi pokazują tylko własne tagi użytkownika.
2. Na `/stories` filtr po tagu zawęża wyniki do własnych opowiadań i działa razem z wyszukiwaniem.
3. Po migracji nic nie jest opublikowane, a aktywne linki udostępniania działają jak dotąd i nie pojawiają się w wynikach.
4. „Publish” dodaje opowiadanie do publicznych wyników, a wyłączenie usuwa je z nich; „Share” i „Stop sharing” tego nie zmieniają.
5. Strona wyszukiwania działa bez logowania i znajduje opublikowane opowiadanie po tytule, tagu i fragmencie treści.
6. Usunięty rozdział lub folder (`deletedAt`) znika z wyników i przestaje być dostępny.
7. Treść dostępna publicznie nie zawiera komentarzy (`stripComments`) ani notatek, a wyniki nie ujawniają e-maila ani `userId`.
8. Tagi nieopublikowanych opowiadań nie są widoczne publicznie ani w podpowiedziach innych użytkowników.
9. Publikować i zmieniać tagi może tylko właściciel; cudze opowiadanie daje `NOT_FOUND`.
10. Przekroczenie limitu zapytań daje komunikat zamiast wyników.
11. Eksport, wersje folderów i `updatedAt` rozdziałów nie zmieniają się przez tagi i „Publish”, chyba że decyzja przy starcie stanowi inaczej.

## Testy

Unit: normalizacja tagów, budowanie zapytań, zawartość wyników bez danych prywatnych. Integracyjne: akcje tagów i publikacji, własność, migracja, filtr `deletedAt: null`, widoczność tylko opublikowanych. E2E: tagowanie i filtr na `/stories`, publikacja i wyszukanie bez logowania, wyłączenie publikacji, usunięcie. `manual`: jakość wyszukiwania po polsku i działanie limitu zapytań na Vercelu.
