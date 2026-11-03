# 48 – Łagodniejszy kontrast i motyw kolorystyczny

Zgłoszenie użytkownika (2026-11-03). Tryb ciemny i jasny mają mieć mniejszy kontrast, a aplikacja kolor akcentu wybrany z kilku propozycji (D52).

## Zakres

- Tryb ciemny: tło nie czysto czarne (dziś `oklch(0.145 0 0)`), tekst lekko przełamana biel (dziś `oklch(0.985 0 0)`); karty, ramki, `muted` i podświetlenia dopasowane do nowego tła.
- Tryb jasny: tło złamana biel zamiast `oklch(1 0 0)`, tekst nie czysto czarny.
- Zmiany tylko w zmiennych CSS w `app/globals.css` (`:root` i `.dark`), bez zmian w komponentach.
- Motyw kolorystyczny: 2–3 propozycje palety akcentu (np. ciepła sepia, chłodny granat, zieleń), każda dla trybu jasnego i ciemnego (`--primary`, `--ring`, zaznaczenia, aktywne tagi, podświetlenie wyszukiwania). Propozycje na podglądzie (zrzuty ekranu albo tymczasowy przełącznik w dev), użytkownik wybiera jedną i ona zostaje kolorem aplikacji.
- Dotyczy też stron publicznych, podglądu markdown, komentarzy w edytorze i strony 404.
- Błąd do poprawy (zgłoszenie użytkownika, 2026-11-03): w trybie ciemnym opcje list rozwijanych są niewidoczne, dopóki się ich nie podświetli. Dotyczy natywnych `<select>`: sortowanie folderów i rozdziałów (`sort-select.tsx`), przenoszenie opowiadania (`move-story-dialog.tsx`), format eksportu (`export-dialog.tsx`). Prawdopodobna przyczyna: brak `color-scheme: dark` w trybie ciemnym, więc przeglądarka rysuje listę opcji na jasnym tle.

## Ustalenia

- Jeden motyw kolorystyczny dla wszystkich, bez wyboru w ustawieniach (decyzja użytkownika). Wybór należy do użytkownika przed zamknięciem taska.
- Kontrast tekstu do tła co najmniej WCAG AA (4,5:1 dla zwykłego tekstu, także `muted-foreground`).

## Kryteria akceptacji

1. W trybie ciemnym tło nie jest czarne, a tekst nie jest czysto biały; w trybie jasnym tło nie jest czysto białe, a tekst nie jest czysto czarny.
2. Wszystkie pary tekst–tło spełniają WCAG AA.
3. Użytkownik dostał 2–3 propozycje palety i wybrał jedną; wybrana działa w obu trybach.
4. W trybie ciemnym opcje wszystkich list rozwijanych są czytelne bez podświetlania.
5. Nic w komponentach nie używa kolorów na sztywno, które omijałyby nowe zmienne (np. `bg-white`, `text-black`).

## Testy

Unit: kontrast WCAG par zmiennych z `globals.css` (obliczenie z wartości `oklch`) dla obu trybów. E2E: istniejący zestaw (bez zmian w zachowaniu); w trybie ciemnym `color-scheme` dokumentu to `dark` (rozwinięta lista natywnego `<select>` nie jest dostępna dla Playwrighta). `manual`: rozwinięte listy w trybie ciemnym (sortowanie, przenoszenie, eksport) czytelne bez podświetlania; przegląd propozycji przez użytkownika i wygląd aplikacji w obu trybach po wyborze; grep po kolorach na sztywno w komponentach.
