# 24 – Tagi

Zgłoszenie użytkownika (2026-10-30), wydzielone z dawnego taska „Tagi i wyszukiwanie publicznych opowiadań”. Publikacja: task 38. Publiczna wyszukiwarka: task 39.

## Zakres

- Tagi na folderach i rozdziałach, z podpowiedziami z własnych tagów użytkownika.
- Filtrowanie po tagach własnych opowiadań na `/stories`, razem z istniejącym wyszukiwaniem.

## Ustalenia

- Tagi na obu poziomach (decyzja użytkownika).

Do decyzji przy starcie taska (wynik jako nowa decyzja w `decisions.md`):

- Normalizacja i limity tagów (długość, liczba, wielkość liter).
- Czy rozdział dziedziczy tagi folderu w filtrze.

## Kryteria akceptacji

1. Tagi można dodawać i usuwać na folderze i na rozdziale, a podpowiedzi pokazują tylko własne tagi użytkownika.
2. Na `/stories` filtr po tagu zawęża wyniki do własnych opowiadań i działa razem z wyszukiwaniem.
3. Zmieniać tagi może tylko właściciel; cudze opowiadanie daje `NOT_FOUND`.
4. Tagi nie są widoczne w podpowiedziach innych użytkowników.
5. Eksport, wersje folderów i `updatedAt` rozdziałów nie zmieniają się przez tagi, chyba że decyzja przy starcie stanowi inaczej.

## Testy

Unit: normalizacja tagów, budowanie zapytań. Integracyjne: akcje tagów, własność, migracja, filtr `deletedAt: null`. E2E: tagowanie i filtr na `/stories`.
