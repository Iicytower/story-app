# 53 – Projekt systemu społecznościowego i plan tasków

Zgłoszenie użytkownika (2026-11-04), wcześniej w backlogu („System społecznościowy (do przemyślenia)”). Task projektowy: opracowanie systemu społecznościowego i rozpisanie go na taski, bez implementacji.

**Zawieszony (2026-11-05, decyzja użytkownika).** Brainstorm zapisany niżej. Przy wznowieniu: rozstrzygnąć „Otwarte kwestie”, dopisać decyzję do `decisions.md`, rozpisać taski i dodać do `CLAUDE.md` (sekcja „Praca z taskami”) wyjątek dla branchy tasków społecznościowych (`feature/social` zamiast `develop`).

## Zakres

- Ustalenie z użytkownikiem funkcji systemu społecznościowego i ich kolejności.
- Decyzja w `docs/decisions.md` opisująca przyjęty model.
- Rozpisanie prac na taski `NN-<slug>.md` (Zakres, Kryteria akceptacji, Testy) i dopisanie ich do tabeli w `README.md`.

## Kryteria akceptacji

1. Zakres systemu społecznościowego uzgodniony z użytkownikiem i zapisany w `docs/decisions.md`.
2. Każdy etap prac ma plik taska i wiersz w tabeli z zależnościami.

## Testy

Bez testów automatycznych: task dotyczy tylko dokumentacji. `manual`: przegląd decyzji i plików tasków przez użytkownika.

## Wyniki brainstormu (2026-11-05)

Ustalenia z użytkownikiem, podstawa decyzji i tasków. Nowych tasków jeszcze nie tworzymy.

### Zakres

- W zakresie: komentarze pod rozdziałem, reakcje, oceny, fora (autora i globalne), profil, obserwowanie, biblioteka, powiadomienia, feed aktywności, wiadomości prywatne, statystyki autora, rankingi na stronie głównej, moderacja (autor, admin, moderatorzy), zgłoszenia, blokowanie użytkowników.
- Poza zakresem: współpraca przy pisaniu (beta-readerzy, współautorzy), komentarze do zaznaczonego fragmentu, listy lektur tworzone przez użytkowników, recenzje książki, wyzwania i konkursy, powiadomienia e-mail (konta bez e-maila, D37).
- Udział (komentarze, reakcje, oceny, posty, DM, obserwowanie, biblioteka) tylko dla zalogowanych. Niezalogowany czyta i widzi liczniki.

### Interakcje z tekstem

- Komentarze pod publicznym rozdziałem: komentarz i odpowiedzi jednego poziomu.
- Reakcje: zestaw kilku reakcji (emoji), jedna na rozdział od użytkownika (zmiana nadpisuje). Ten sam mechanizm i zestaw dla komentarzy i postów forum.
- Oceny 1–5: osobno rozdział i osobno książka (folder), jedna ocena od użytkownika na obiekt.
- Format komentarzy, postów i DM: prosty markdown (pogrubienie, kursywa, linki, cytat) w textarea, render przez `react-markdown` bez HTML.
- Wzmianki `@nick`: link do profilu i powiadomienie dla wspomnianego (nie przy blokadzie).
- Własny komentarz lub post: edycja w oknie czasu (np. 15 min, wartość do ustalenia w tasku), potem tylko usunięcie.
- Cofnięcie publikacji lub usunięcie rozdziału ukrywa komentarze, reakcje i oceny, ale ich nie kasuje; ponowna publikacja je przywraca (spójne z D38). Twarde usunięcie razem z rozdziałem.

### Fora

- Forum autora (moderuje autor i jego moderatorzy) oraz globalne kategorie (moderuje admin i moderatorzy kategorii).
- Struktura: kategoria → wątek → płaska lista postów z cytowaniem.

### Relacje

- Profil `/p/<nick>`: bio, avatar (upload jak okładki, task 26), lista opublikowanych książek, obserwujący i obserwowani (listy), publiczna biblioteka z przełącznikiem prywatności. Bez licznika reakcji.
- Obserwowanie autorów.
- Biblioteka czytelnika: zapisane książki, postęp czytania („Czytaj dalej”), oznaczenie nowych / nieprzeczytanych rozdziałów z powiadomieniem, własne półki.
- Feed aktywności: nowe rozdziały obserwowanych autorów i aktywność w ich społeczności.
- Wiadomości prywatne: każdy do każdego, z limitem nowych rozmów (D40) i blokowaniem.

### Powiadomienia i realtime

- Kanał: tylko w aplikacji (dzwonek w sidebarze z licznikiem, lista).
- Docelowo realtime dla DM i powiadomień. Wybór technologii (zewnętrzna usługa typu Pusher/Ably, serwer Mikrus, SSE) to osobny task z rozpoznaniem; do tego czasu polling.

### Moderacja

- Autor moderuje swoją społeczność (komentarze pod swoimi rozdziałami i książkami, forum autora): usuwanie / ukrywanie cudzych treści, ban w społeczności (zbanowany nie komentuje, nie reaguje, nie ocenia, nie pisze na forum autora), wyłączanie komentarzy per książka / rozdział, wyznaczanie moderatorów spośród czytelników.
- Zgłoszenia: treść w społeczności autora → autor (i jego moderatorzy). Zgłoszenie samego rozdziału, książki lub autora oraz treści z globalnych forów → admin.
- Admin: rola ustawiana ręcznie (baza lub skrypt). Admin wyznacza moderatorów globalnych kategorii.
- Blokowanie (dowolny użytkownik A blokuje B), pełne odcięcie: B nie pisze do A DM, nie odpowiada na komentarze A, nie wspomina A, nie obserwuje A; jeśli A jest autorem, B ma u niego ban. A nie widzi komentarzy i postów B nigdzie. B nadal czyta publiczne teksty A.

### Statystyki i odkrywanie

- Statystyki autora: unikalni czytelnicy na dobę (zalogowany po koncie, niezalogowany po HMAC IP jak w D40, bez jawnego IP), reakcje, oceny, komentarze, obserwujący, biblioteki; per rozdział i w czasie.
- Strona główna (obok „Recently published”, D54): popularne tygodnia, najwyżej oceniane (z minimalną liczbą ocen), od obserwowanych (dla zalogowanego), popularne wg tagów (D36).

### Wydanie

- Cały system społecznościowy wchodzi w jednym wydaniu, łącznie z realtime (decyzja użytkownika).
- Branch zbiorczy `feature/social` z `develop`: branche tasków społecznościowych (`feature/NN-<slug>`) powstają z niego i do niego są mergowane, a do `develop` trafia całość po ukończeniu wszystkich tasków. Inne taski idą na `develop` i wydania jak dotąd. `develop` mergujemy okresowo do `feature/social`, żeby ograniczyć konflikty.

### Kolejność realizacji (decyzja użytkownika: relacje najpierw)

1. Fundament: model społeczności (role, ban, blokada jako dane), profil `/p/<nick>`.
2. Obserwowanie → biblioteka (półki, postęp, nowe rozdziały) → feed.
3. Interakcje: komentarze, reakcje, oceny, moderacja autora i zgłoszenia.
4. Powiadomienia (polling), wzmianki.
5. Statystyki autora, rankingi na stronie głównej.
6. DM, blokowanie w pełnym zakresie.
7. Fora autora i globalne, admin i moderatorzy kategorii.
8. Realtime (rozpoznanie i wdrożenie).

### Otwarte kwestie

- Konkretny zestaw reakcji i długość okna edycji.
- Usuwanie konta i los treści społecznościowych (dziś brak usuwania konta).
- Limity antyspamowe dla komentarzy, postów i DM (wartości).
- Gdzie w nawigacji: profil, biblioteka, feed, fora, DM, panel moderacji (sidebar, D42).
