# 48 – Łagodniejszy kontrast i motyw kolorystyczny

Zgłoszenie użytkownika (2026-11-03). Tryb ciemny i jasny mają mieć mniejszy kontrast, a aplikacja kolor akcentu wybrany z kilku propozycji (D52).

## Zakres

- Tryb ciemny: tło nie czysto czarne (dziś `oklch(0.145 0 0)`), tekst lekko przełamana biel (dziś `oklch(0.985 0 0)`); karty, ramki, `muted` i podświetlenia dopasowane do nowego tła.
- Tryb jasny: tło złamana biel zamiast `oklch(1 0 0)`, tekst nie czysto czarny.
- Zmiany tylko w zmiennych CSS w `app/globals.css` (`:root` i `.dark`), bez zmian w komponentach.
- Motyw kolorystyczny: 2–3 propozycje palety akcentu (np. ciepła sepia, chłodny granat, zieleń), każda dla trybu jasnego i ciemnego (`--primary`, `--ring`, zaznaczenia, aktywne tagi, podświetlenie wyszukiwania). Propozycje na podglądzie (zrzuty ekranu albo tymczasowy przełącznik w dev), użytkownik wybiera jedną i ona zostaje kolorem aplikacji.
- Dotyczy też stron publicznych, podglądu markdown, komentarzy w edytorze i strony 404.

## Ustalenia

- Jeden motyw kolorystyczny dla wszystkich, bez wyboru w ustawieniach (decyzja użytkownika). Wybór należy do użytkownika przed zamknięciem taska.
- Kontrast tekstu do tła co najmniej WCAG AA (4,5:1 dla zwykłego tekstu, także `muted-foreground`).

## Kryteria akceptacji

1. W trybie ciemnym tło nie jest czarne, a tekst nie jest czysto biały; w trybie jasnym tło nie jest czysto białe, a tekst nie jest czysto czarny.
2. Wszystkie pary tekst–tło spełniają WCAG AA.
3. Użytkownik dostał 2–3 propozycje palety i wybrał jedną; wybrana działa w obu trybach.
4. Nic w komponentach nie używa kolorów na sztywno, które omijałyby nowe zmienne (np. `bg-white`, `text-black`).

## Testy

Unit: kontrast WCAG par zmiennych z `globals.css` (obliczenie z wartości `oklch`) dla obu trybów. E2E: istniejący zestaw (bez zmian w zachowaniu). `manual`: przegląd propozycji przez użytkownika i wygląd aplikacji w obu trybach po wyborze; grep po kolorach na sztywno w komponentach.
