# 39 – Publiczna wyszukiwarka

Wydzielone z dawnego taska 24 (zgłoszenie z 2026-10-30).

## Zakres

- Publiczna strona wyszukiwania bez logowania: po tytule, tagach i treści opublikowanych opowiadań, z wynikami prowadzącymi do strony czytania.
- Limit zapytań, mechanizmem z taska 37.

## Ustalenia

- Wyszukiwanie obejmuje tytuł, tagi i treść oraz tagi z obu poziomów (decyzja użytkownika).

- Regex, tagi folderu dziedziczone, strona indeksowana (D42).
- Rozszerzenie zakresu (decyzja użytkownika): wyszukiwarka na `/`, dialog logowania i rejestracji zamiast `/login` i `/register`, sidebar zamiast menu konta (D42).

## Kryteria akceptacji

1. Strona działa bez logowania i znajduje opublikowane opowiadanie po tytule, tagu i fragmencie treści.
2. Wyłączenie „Publish” lub usunięcie opowiadania zabiera je z wyników.
3. Nieopublikowany rozdział opublikowanego folderu nie pojawia się w wynikach.
4. Wyniki pokazują nick i nie ujawniają `userId`, notatek ani komentarzy.
5. Tagi nieopublikowanych opowiadań nie są widoczne publicznie.
6. Przekroczenie limitu daje komunikat zamiast wyników.

## Testy

Unit: budowanie zapytań, zawartość wyników. Integracyjne: widoczność tylko opublikowanych, `deletedAt: null`. E2E: wyszukanie bez logowania, wyłączenie publikacji, usunięcie. `manual`: jakość wyszukiwania po polsku i limit na Vercelu.
