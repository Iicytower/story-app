# D52 – Łagodniejszy kontrast i jeden motyw kolorystyczny (2026-11-03)

Status: aktualna.

- Oba tryby dostają mniejszy kontrast: w ciemnym tło nie czarne i tekst nie czysto biały, w jasnym tło złamana biel i tekst nie czysto czarny, przy zachowaniu WCAG AA (decyzja użytkownika, task 48).
- ~~Kolor akcentu aplikacji wybiera użytkownik spośród 2–3 propozycji przygotowanych w tasku; jeden motyw dla wszystkich, bez wyboru w ustawieniach.~~ Zmiana przy wyborze propozycji (decyzja użytkownika, 2026-11-04): pięć palet akcentu (sepia, granat, szałwia, śliwka, morski) do wyboru w dialogu ustawień jako próbki kolorów (`appearance.accent`); domyślna sepia. Paleta podbarwia też tła, tekst, ramki, podświetlenie wyszukiwania i komentarze.
- Paleta jest atrybutem `data-accent` na `<html>`, ustawianym przez layout z ustawień zalogowanego użytkownika. Strony publiczne mają paletę oglądającego; bez sesji obowiązuje domyślna (bez kopii w `localStorage`, inaczej niż motyw).
- Kolory w komponentach tylko przez zmienne z `app/globals.css`, także podświetlenia wyszukiwania (`highlight`, `highlight-current`), komentarze (`comment`, `comment-border`), diff wersji (`diff-added`, `diff-removed`) i korekta (`proofread-note`, D59). Wyjątek: przyciemnienie tła pod dialogiem (`bg-black/10`), bo to cień, nie kolor tekstu ani tła treści.
- `color-scheme: dark` w trybie ciemnym, więc natywne kontrolki (listy `<select>`) są ciemne. Kolory `prose` (podgląd markdown, edytor) też idą ze zmiennych.
